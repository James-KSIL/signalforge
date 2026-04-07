import path from 'path';
import fs from 'fs';
import { CHAT_EVENTS_SCHEMA } from './schema';
import { createEvent } from '../events/helpers';
import { PROJECTS_SESSIONS_SCHEMA } from './schema';
import { COPILOT_EVIDENCE_SCHEMA } from './schema';

// Lightweight in-memory/file-backed fallback for environments where sqlite3
// native bindings are unavailable (used for developer validation/testing).
class InMemoryDb {
  filePath: string;
  constructor(filePath: string) {
    this.filePath = filePath;
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(
        this.filePath,
        JSON.stringify({
          chat_events: [],
          sessions: [],
          outcomes: [],
          copilot_candidate_staging: [],
          copilot_execution_artifacts: [],
        }, null, 2)
      );
    }
  }
  exec(_sql: string, cb: (err?: any) => void) {
    // noop for schema initialization
    cb && cb();
  }
  run(sql: string, params: any[], cb: (err?: any) => void) {
    try {
      if (!/insert\s+into\s+chat_events/i.test(sql)) {
        cb && cb();
        return;
      }

      const raw = fs.readFileSync(this.filePath, 'utf8');
      const obj = JSON.parse(raw || '{}');
      obj.chat_events = obj.chat_events || [];
      // simple mapping: map params in expected order to an object
      const [event_id, chat_thread_id, project_id, session_id, dispatch_id, source, turn_index, role, event_type, content, artifact_refs, source_url, matched_trigger, created_at] = params;

      // If this run call is inserting into chat_events, force canonical validation.
      try {
        // parse content if it's JSON string
        let parsedContent: any = content;
        if (typeof content === 'string') {
          try { parsedContent = JSON.parse(content); } catch { parsedContent = { summary: String(content) }; }
        }

        const evt = createEvent({
          thread_id: chat_thread_id,
          project_id,
          session_id,
          dispatch_id,
          source: source as any,
          role: role as any,
          event_type: event_type as any,
          content: parsedContent,
        });

        // log the canonical event for traceability
        console.log('InMemoryDb: inserting chat_event', { event_id: evt.event_id, chat_thread_id: evt.thread_id, role: evt.role, event_type: evt.event_type, created_at: evt.timestamp });

        obj.chat_events.push({
          event_id: evt.event_id,
          chat_thread_id: evt.thread_id,
          project_id: evt.project_id,
          session_id: evt.session_id || null,
          dispatch_id: evt.dispatch_id || null,
          source: evt.source,
          turn_index,
          role: evt.role,
          event_type: evt.event_type,
          content: evt.content,
          artifact_refs: artifact_refs || null,
          source_url,
          matched_trigger,
          created_at: evt.timestamp,
        });
      } catch (e) {
        // fail loudly to enforce canonical writes
        return cb && cb(e);
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
      cb && cb();
    } catch (err) {
      cb && cb(err);
    }
  }
  all(sql: string, params: any[], cb: (err: any, rows?: any[]) => void) {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const obj = JSON.parse(raw || '{}');
      obj.chat_events = obj.chat_events || [];
      // simple SQL handling: support queries by chat_thread_id
      const whereThreadMatch = /WHERE\s+chat_thread_id\s*=\s*\?/i.test(sql);
      const whereTypeMatch = /WHERE\s+event_type\s*=\s*\?/i.test(sql);
      if (whereThreadMatch && params && params.length > 0) {
        const threadId = params[0];
        const rows = obj.chat_events.filter((r: any) => r.chat_thread_id === threadId);
        return cb(null, rows);
      }
      if (whereTypeMatch && params && params.length > 0) {
        const eventType = params[0];
        const rows = obj.chat_events
          .filter((r: any) => r.event_type === eventType)
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
        return cb(null, rows.length ? [rows[0]] : []);
      }
      // return all chat events by default
      return cb(null, obj.chat_events.slice());
    } catch (err) {
      return cb(err);
    }
}

  close(cb?: (err?: any) => void) {
    if (cb) cb();
  }

}

export function getDefaultDbPath(): string {
  const configuredPath = process.env.SIGNALFORGE_DB_PATH;
  if (configuredPath && configuredPath.trim()) {
    return path.resolve(configuredPath);
  }

  let currentDir = __dirname;
  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson && packageJson.name === 'signalforge-dispatch') {
          return path.resolve(currentDir, 'apps/native-host/data/signalforge.db');
        }
      } catch {
        // Ignore malformed package.json files and keep walking upward.
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return path.resolve(__dirname, '../../../../../../apps/native-host/data/signalforge.db');
}

export function ensureDbDir(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function openDatabase(dbPath?: string): any {
  const finalPath = dbPath || getDefaultDbPath();
  ensureDbDir(finalPath);
  if (process.env.SIGNALFORGE_USE_INMEMORY_DB === '1') {
    const jsonPath = path.resolve(path.dirname(finalPath), 'signalforge.json');
    return new InMemoryDb(jsonPath) as any;
  }
  // require sqlite3 lazily so environments without native bindings can opt-in
  // to the in-memory fallback via SIGNALFORGE_USE_INMEMORY_DB.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqlite3 = require('sqlite3');
  const db = new sqlite3.Database(finalPath);
  // Initialize schema immediately after opening SQLite connection
  // to ensure all required tables exist on first run
  initSchema(db).catch((err: any) => {
    console.error('[SignalForge] schema initialization error:', err);
  });
  return db as any;
}

export function initSchema(db: any): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(CHAT_EVENTS_SCHEMA + "\n" + PROJECTS_SESSIONS_SCHEMA + "\n" + COPILOT_EVIDENCE_SCHEMA, (err: any) => {
      if (err) return reject(err);
      const backfills = [
        "ALTER TABLE chat_events ADD COLUMN project_id TEXT",
        "ALTER TABLE chat_events ADD COLUMN session_id TEXT",
        "ALTER TABLE chat_events ADD COLUMN dispatch_id TEXT",
        "ALTER TABLE chat_events ADD COLUMN source TEXT",
        "ALTER TABLE chat_events ADD COLUMN artifact_refs TEXT",
        "ALTER TABLE copilot_candidate_staging ADD COLUMN content_hash TEXT",
        "ALTER TABLE copilot_candidate_staging ADD COLUMN contract_ref TEXT",
        "ALTER TABLE copilot_candidate_staging ADD COLUMN diagnostic_score INTEGER",
        "ALTER TABLE copilot_candidate_staging ADD COLUMN gate_pass INTEGER",
        "ALTER TABLE copilot_candidate_staging ADD COLUMN gate_failure_reason TEXT",
        "ALTER TABLE copilot_candidate_staging ADD COLUMN failed_invariants_json TEXT",
        "ALTER TABLE outcome_logs ADD COLUMN candidate_id TEXT",
        "ALTER TABLE outcome_logs ADD COLUMN rejection_reason TEXT",
      ];
      let idx = 0;
      const next = () => {
        if (idx >= backfills.length) return resolve();
        const sql = backfills[idx++];
        db.run(sql, [], (_alterErr: any) => {
          // ignore duplicate-column or unsupported-table-alter errors
          next();
        });
      };
      next();
    });
  });
}

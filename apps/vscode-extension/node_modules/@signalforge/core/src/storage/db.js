"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSchema = exports.openDatabase = exports.ensureDbDir = exports.getDefaultDbPath = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const schema_1 = require("./schema");
const helpers_1 = require("../events/helpers");
const schema_2 = require("./schema");
// Lightweight in-memory/file-backed fallback for environments where sqlite3
// native bindings are unavailable (used for developer validation/testing).
class InMemoryDb {
    constructor(filePath) {
        this.filePath = filePath;
        if (!fs_1.default.existsSync(this.filePath))
            fs_1.default.writeFileSync(this.filePath, JSON.stringify({ chat_events: [], sessions: [], outcomes: [] }, null, 2));
    }
    exec(_sql, cb) {
        // noop for schema initialization
        cb && cb();
    }
    run(sql, params, cb) {
        try {
            if (!/insert\s+into\s+chat_events/i.test(sql)) {
                cb && cb();
                return;
            }
            const raw = fs_1.default.readFileSync(this.filePath, 'utf8');
            const obj = JSON.parse(raw || '{}');
            obj.chat_events = obj.chat_events || [];
            // simple mapping: map params in expected order to an object
            const [event_id, chat_thread_id, project_id, session_id, dispatch_id, source, turn_index, role, event_type, content, artifact_refs, source_url, matched_trigger, created_at] = params;
            // If this run call is inserting into chat_events, force canonical validation.
            try {
                // parse content if it's JSON string
                let parsedContent = content;
                if (typeof content === 'string') {
                    try {
                        parsedContent = JSON.parse(content);
                    }
                    catch {
                        parsedContent = { summary: String(content) };
                    }
                }
                const evt = (0, helpers_1.createEvent)({
                    thread_id: chat_thread_id,
                    project_id,
                    session_id,
                    dispatch_id,
                    source: source,
                    role: role,
                    event_type: event_type,
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
            }
            catch (e) {
                // fail loudly to enforce canonical writes
                return cb && cb(e);
            }
            fs_1.default.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
            cb && cb();
        }
        catch (err) {
            cb && cb(err);
        }
    }
    all(sql, params, cb) {
        try {
            const raw = fs_1.default.readFileSync(this.filePath, 'utf8');
            const obj = JSON.parse(raw || '{}');
            obj.chat_events = obj.chat_events || [];
            // simple SQL handling: support queries by chat_thread_id
            const whereThreadMatch = /WHERE\s+chat_thread_id\s*=\s*\?/i.test(sql);
            const whereTypeMatch = /WHERE\s+event_type\s*=\s*\?/i.test(sql);
            if (whereThreadMatch && params && params.length > 0) {
                const threadId = params[0];
                const rows = obj.chat_events.filter((r) => r.chat_thread_id === threadId);
                return cb(null, rows);
            }
            if (whereTypeMatch && params && params.length > 0) {
                const eventType = params[0];
                const rows = obj.chat_events
                    .filter((r) => r.event_type === eventType)
                    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
                return cb(null, rows.length ? [rows[0]] : []);
            }
            // return all chat events by default
            return cb(null, obj.chat_events.slice());
        }
        catch (err) {
            return cb(err);
        }
    }
}
function getDefaultDbPath() {
    const p = path_1.default.resolve(process.cwd(), './data/signalforge.db');
    return p;
}
exports.getDefaultDbPath = getDefaultDbPath;
function ensureDbDir(dbPath) {
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
}
exports.ensureDbDir = ensureDbDir;
function openDatabase(dbPath) {
    const finalPath = dbPath || getDefaultDbPath();
    ensureDbDir(finalPath);
    if (process.env.SIGNALFORGE_USE_INMEMORY_DB === '1') {
        const jsonPath = path_1.default.resolve(path_1.default.dirname(finalPath), 'signalforge.json');
        return new InMemoryDb(jsonPath);
    }
    // require sqlite3 lazily so environments without native bindings can opt-in
    // to the in-memory fallback via SIGNALFORGE_USE_INMEMORY_DB.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(finalPath);
    return db;
}
exports.openDatabase = openDatabase;
function initSchema(db) {
    return new Promise((resolve, reject) => {
        db.exec(schema_1.CHAT_EVENTS_SCHEMA + "\n" + schema_2.PROJECTS_SESSIONS_SCHEMA, (err) => {
            if (err)
                return reject(err);
            const backfills = [
                "ALTER TABLE chat_events ADD COLUMN project_id TEXT",
                "ALTER TABLE chat_events ADD COLUMN session_id TEXT",
                "ALTER TABLE chat_events ADD COLUMN dispatch_id TEXT",
                "ALTER TABLE chat_events ADD COLUMN source TEXT",
                "ALTER TABLE chat_events ADD COLUMN artifact_refs TEXT",
            ];
            let idx = 0;
            const next = () => {
                if (idx >= backfills.length)
                    return resolve();
                const sql = backfills[idx++];
                db.run(sql, [], (_alterErr) => {
                    // ignore duplicate-column or unsupported-table-alter errors
                    next();
                });
            };
            next();
        });
    });
}
exports.initSchema = initSchema;

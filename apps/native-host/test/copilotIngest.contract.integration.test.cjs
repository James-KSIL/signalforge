const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const sqlite3 = require('sqlite3');

const fixtures = require('./fixtures/copilot-ingest-fixtures.json');
const {
  handleInbound,
  closeNativeHostDatabase,
} = require('../dist/services/ingestService.js');

function computeContentHash(text) {
  return `sha256_${crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex')}`;
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function closeSqlite(db) {
  return new Promise((resolve) => db.close(() => resolve()));
}

function mkSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-native-ingest-'));
  const workspaceRoot = path.join(root, 'workspace');
  const dbPath = path.join(root, 'signalforge.db');
  fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });

  return {
    root,
    workspaceRoot,
    dbPath,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function toMessage(messageId, payload) {
  return {
    kind: 'browser_event',
    message_id: messageId,
    payload,
  };
}

async function queryCandidateAndArtifacts(dbPath, candidateId) {
  const db = new sqlite3.Database(dbPath);
  try {
    const candidate = await get(
      db,
      `SELECT candidate_id, content_hash, diagnostic_score, gate_pass, gate_failure_reason, failed_invariants_json, validation_status
       FROM copilot_candidate_staging
       WHERE candidate_id = ?`,
      [candidateId]
    );

    const artifacts = await all(
      db,
      'SELECT artifact_id, candidate_id FROM copilot_execution_artifacts WHERE candidate_id = ?',
      [candidateId]
    );

    return { candidate, artifacts };
  } finally {
    await closeSqlite(db);
  }
}

test.beforeEach(async () => {
  await closeNativeHostDatabase();
  process.env.SIGNALFORGE_ALLOW_CONTENT_HASH_OVERRIDE = '1';
});

test.afterEach(async () => {
  await closeNativeHostDatabase();
  delete process.env.SIGNALFORGE_DB_PATH;
  delete process.env.SIGNALFORGE_ALLOW_CONTENT_HASH_OVERRIDE;
});

for (const fixture of fixtures) {
  test(fixture.name, async () => {
    const sandbox = mkSandbox();

    try {
      process.env.SIGNALFORGE_DB_PATH = sandbox.dbPath;

      const pathMatches = fixture.raw_text.match(/src\/[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]+/g) || [];
      for (const rel of pathMatches) {
        const fullPath = path.join(sandbox.workspaceRoot, rel);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        if (!fs.existsSync(fullPath)) {
          fs.writeFileSync(fullPath, 'export const value = true;\n', 'utf8');
        }
      }

      const projectId = `proj_${fixture.id}`;
      const sessionId = `sess_${fixture.id}`;
      const dispatchId = `disp_${fixture.id}`;

      const bootstrapResp = await handleInbound(
        toMessage(`bootstrap_${fixture.id}`, {
          type: 'bootstrap_authority',
          project_id: projectId,
          project_label: projectId,
          authority: 'vscode',
          timestamp: '2026-04-05T00:00:00.000Z',
          workspace_root: sandbox.workspaceRoot,
          session_id: sessionId,
          dispatch_id: dispatchId,
        })
      );

      assert.equal(bootstrapResp.status, 'accepted');

      const payload = {
        type: 'copilot_candidate_captured',
        candidate_id: fixture.id,
        project_id: projectId,
        session_id: sessionId,
        dispatch_id: dispatchId,
        captured_at: '2026-04-05T00:00:01.000Z',
        source: fixture.source,
        raw_text: fixture.raw_text,
        content_hash: fixture.content_hash === '__COMPUTE__' ? computeContentHash(fixture.raw_text) : fixture.content_hash,
        signal_flags: { deterministic_fixture: true },
        capture_context: { fixture: fixture.name },
      };

      const ingestResp = await handleInbound(toMessage(`msg_${fixture.id}`, payload));
      assert.equal(ingestResp.status, 'accepted');

      const { candidate, artifacts } = await queryCandidateAndArtifacts(sandbox.dbPath, fixture.id);

      assert.ok(candidate, 'candidate must remain staged for deterministic auditability');
      assert.equal(candidate.validation_status, fixture.expected_status);
      assert.equal(candidate.gate_pass, fixture.expected_gate_pass);

      if (fixture.expected_failure_reason) {
        assert.equal(candidate.gate_failure_reason, fixture.expected_failure_reason);
      }

      if (fixture.expected_promoted) {
        assert.equal(artifacts.length, 1, 'exactly one promotion artifact expected');
      } else {
        assert.equal(artifacts.length, 0, 'rejected candidates must not be promoted');
      }

      if (fixture.id === 'cand_fixture_valid') {
        assert.equal(typeof candidate.content_hash, 'string');
        assert.ok(candidate.content_hash.length > 0);
        assert.equal(typeof candidate.diagnostic_score, 'number');
        assert.equal(candidate.gate_pass, 1);
        assert.equal(candidate.gate_failure_reason, null);
        assert.equal(typeof candidate.failed_invariants_json, 'string');
      }
    } finally {
      await closeNativeHostDatabase();
      sandbox.cleanup();
    }
  });
}

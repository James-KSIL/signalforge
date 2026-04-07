const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const sqlite3 = require('sqlite3');

const {
  handleInbound,
  closeNativeHostDatabase,
} = require('../dist/services/ingestService.js');

function computeContentHash(text) {
  return `sha256_${crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex')}`;
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-outcome-test-'));
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

async function queryOutcomeByCandidate(dbPath, candidateId) {
  const db = new sqlite3.Database(dbPath);
  try {
    return await get(
      db,
      `SELECT outcome_id, candidate_id, dispatch_id, contract_ref, artifact_ref, rejection_reason, outcome_status, outcome_summary
       FROM outcome_logs
       WHERE candidate_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [candidateId]
    );
  } finally {
    await closeSqlite(db);
  }
}

async function queryOutcomeCount(dbPath) {
  const db = new sqlite3.Database(dbPath);
  try {
    const row = await get(db, 'SELECT COUNT(*) AS count FROM outcome_logs', []);
    return Number(row?.count || 0);
  } finally {
    await closeSqlite(db);
  }
}

async function queryLatestContractRef(dbPath, projectId, sessionId) {
  const db = new sqlite3.Database(dbPath);
  try {
    const row = await get(
      db,
      `SELECT event_id, content
       FROM chat_events
       WHERE project_id = ?
         AND session_id = ?
         AND event_type = 'chatgpt_turn_classified'
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId, sessionId]
    );

    if (!row) return null;

    try {
      const content = JSON.parse(String(row.content || '{}'));
      if (content?.classification === 'contract_input') {
        return row.event_id;
      }
    } catch {
      return null;
    }

    return null;
  } finally {
    await closeSqlite(db);
  }
}

async function queryCandidateAndArtifacts(dbPath, candidateId) {
  const db = new sqlite3.Database(dbPath);
  try {
    const candidate = await get(
      db,
      `SELECT candidate_id, contract_ref, content_hash, diagnostic_score, gate_pass, gate_failure_reason, failed_invariants_json, validation_status, rejection_reason
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

async function seedBootstrap(dbPath, sandbox, projectId, sessionId, dispatchId) {
  process.env.SIGNALFORGE_DB_PATH = dbPath;

  const bootstrapResp = await handleInbound(
    toMessage(`bootstrap_${projectId}`, {
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
}

async function seedContractInput(projectId, sessionId, dispatchId, eventId) {
  const resp = await handleInbound(
    toMessage(eventId, {
      type: 'chatgpt_turn_classified',
      project_id: projectId,
      session_id: sessionId,
      dispatch_id: dispatchId,
      chatThreadId: sessionId,
      turnIndex: 0,
      role: 'assistant',
      eventId,
      timestamp: '2026-04-05T00:00:00.500Z',
      summary_reason: 'contract input seeded for outcome linkage tests',
      classification: 'contract_input',
      classification_signals: ['fixture_contract_input'],
      sourceUrl: 'https://example.com/contract',
      content: 'Contract reference material',
    })
  );

  assert.equal(resp.status, 'accepted');
  return await queryLatestContractRef(process.env.SIGNALFORGE_DB_PATH, projectId, sessionId);
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

test('promoted outcome linkage records candidate, dispatch, contract, and artifact ids', async () => {
  const sandbox = mkSandbox();
  try {
    const candidateId = 'cand_outcome_promoted';
    const projectId = `proj_${candidateId}`;
    const sessionId = `sess_${candidateId}`;
    const dispatchId = `disp_${candidateId}`;

    fs.writeFileSync(path.join(sandbox.workspaceRoot, 'src', 'promoted.ts'), 'export const promoted = true;\n', 'utf8');

    await seedBootstrap(sandbox.dbPath, sandbox, projectId, sessionId, dispatchId);
    const contractRef = await seedContractInput(projectId, sessionId, dispatchId, `contract_${candidateId}`);

    const countBefore = await queryOutcomeCount(sandbox.dbPath);
    assert.equal(countBefore, 0, 'no outcome row should exist before validation resolution');

    const rawText = 'Created src/promoted.ts\npnpm build\nExit code: 0';
    const contentHash = computeContentHash(rawText);

    const ingestResp = await handleInbound(
      toMessage(`candidate_${candidateId}`, {
        type: 'copilot_candidate_captured',
        candidate_id: candidateId,
        project_id: projectId,
        session_id: sessionId,
        dispatch_id: dispatchId,
        contract_ref: contractRef,
        captured_at: '2026-04-05T00:00:01.000Z',
        source: 'clipboard',
        raw_text: rawText,
        content_hash: contentHash,
        signal_flags: { test_case: 'promoted_outcome' },
        capture_context: { case: 'promoted_outcome' },
      })
    );

    assert.equal(ingestResp.status, 'accepted');

    const { candidate, artifacts } = await queryCandidateAndArtifacts(sandbox.dbPath, candidateId);
    const outcome = await queryOutcomeByCandidate(sandbox.dbPath, candidateId);

    assert.ok(candidate, 'candidate must be staged');
    assert.equal(candidate.contract_ref, contractRef);
    assert.equal(candidate.validation_status, 'promoted');
    assert.equal(candidate.gate_pass, 1);
    assert.equal(artifacts.length, 1, 'exactly one artifact must be created');
    assert.ok(outcome, 'promoted outcome must be written');
    assert.equal(outcome.candidate_id, candidateId);
    assert.equal(outcome.dispatch_id, dispatchId);
    assert.equal(outcome.contract_ref, contractRef);
    assert.equal(outcome.artifact_ref, artifacts[0].artifact_id);
    assert.equal(outcome.rejection_reason, null);
  } finally {
    await closeNativeHostDatabase();
    sandbox.cleanup();
  }
});

test('rejected outcome linkage records candidate, dispatch, contract, null artifact ref, and rejection reason', async () => {
  const sandbox = mkSandbox();
  try {
    const candidateId = 'cand_outcome_rejected';
    const projectId = `proj_${candidateId}`;
    const sessionId = `sess_${candidateId}`;
    const dispatchId = `disp_${candidateId}`;

    fs.writeFileSync(path.join(sandbox.workspaceRoot, 'src', 'rejected.ts'), 'export const rejected = true;\n', 'utf8');

    await seedBootstrap(sandbox.dbPath, sandbox, projectId, sessionId, dispatchId);
    const contractRef = await seedContractInput(projectId, sessionId, dispatchId, `contract_${candidateId}`);

    const countBefore = await queryOutcomeCount(sandbox.dbPath);
    assert.equal(countBefore, 0, 'no outcome row should exist before validation resolution');

    const rawText = 'This content has no workspace file references and must be rejected.';
    const contentHash = computeContentHash(rawText);

    const ingestResp = await handleInbound(
      toMessage(`candidate_${candidateId}`, {
        type: 'copilot_candidate_captured',
        candidate_id: candidateId,
        project_id: projectId,
        session_id: sessionId,
        dispatch_id: dispatchId,
        contract_ref: contractRef,
        captured_at: '2026-04-05T00:00:01.000Z',
        source: 'clipboard',
        raw_text: rawText,
        content_hash: contentHash,
        signal_flags: { test_case: 'rejected_outcome' },
        capture_context: { case: 'rejected_outcome' },
      })
    );

    assert.equal(ingestResp.status, 'accepted');

    const { candidate, artifacts } = await queryCandidateAndArtifacts(sandbox.dbPath, candidateId);
    const outcome = await queryOutcomeByCandidate(sandbox.dbPath, candidateId);

    assert.ok(candidate, 'candidate must be staged');
    assert.equal(candidate.contract_ref, contractRef);
    assert.equal(candidate.validation_status, 'rejected');
    assert.equal(candidate.gate_pass, 0);
    assert.ok(candidate.rejection_reason, 'candidate rejection reason must be populated');
    assert.equal(artifacts.length, 0, 'rejected candidates must not create an artifact');
    assert.ok(outcome, 'rejected outcome must be written');
    assert.equal(outcome.candidate_id, candidateId);
    assert.equal(outcome.dispatch_id, dispatchId);
    assert.equal(outcome.contract_ref, contractRef);
    assert.equal(outcome.artifact_ref, null);
    assert.ok(outcome.rejection_reason, 'outcome rejection reason must be populated');
    assert.equal(outcome.rejection_reason, candidate.rejection_reason);
  } finally {
    await closeNativeHostDatabase();
    sandbox.cleanup();
  }
});

test('artifact_bound alone does not create a final outcome_log row', async () => {
  const sandbox = mkSandbox();
  try {
    const projectId = 'proj_early_guard';
    const sessionId = 'sess_early_guard';
    const dispatchId = 'disp_early_guard';

    await seedBootstrap(sandbox.dbPath, sandbox, projectId, sessionId, dispatchId);

    const resp = await handleInbound(
      toMessage('artifact_bound_early_guard', {
        type: 'artifact_bound',
        chat_id: 'chat_early_guard',
        project_id: projectId,
        session_id: sessionId,
        dispatch_id: dispatchId,
        authority: 'manual_selection',
        copied_text: 'artifact_bound must not emit a final outcome',
        selection_type: 'manual',
        source_url: 'https://example.com/chat',
        created_at: '2026-04-05T00:00:02.000Z',
      })
    );

    assert.equal(resp.status, 'accepted');
    assert.equal(await queryOutcomeCount(sandbox.dbPath), 0);
  } finally {
    await closeNativeHostDatabase();
    sandbox.cleanup();
  }
});
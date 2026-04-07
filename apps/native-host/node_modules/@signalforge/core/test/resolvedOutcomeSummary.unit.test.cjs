const test = require('node:test');
const assert = require('node:assert/strict');

const { buildResolvedOutcomeSummary } = require('../dist/artifacts/resolvedOutcomeSummary.js');

function makeBundle(overrides = {}) {
  return {
    outcome: {
      outcome_id: 'out_123',
      project_id: 'proj_123',
      session_id: 'sess_123',
      dispatch_id: 'disp_123',
      candidate_id: 'cand_123',
      created_at: '2026-04-05T00:00:10.000Z',
      contract_ref: 'evt_contract_123',
      artifact_ref: 'art_123',
      verification_ref: null,
      rejection_reason: null,
      outcome_summary: 'candidate promoted',
      outcome_status: 'success',
      source: 'auto',
    },
    candidate: {
      candidate_id: 'cand_123',
      project_id: 'proj_123',
      session_id: 'sess_123',
      dispatch_id: 'disp_123',
      contract_ref: 'evt_contract_123',
      captured_at: '2026-04-05T00:00:01.000Z',
      source: 'clipboard',
      raw_text: 'Created src/example.ts\npnpm build\nExit code: 0',
      content_hash: 'sha256_abc',
      signal_flags_json: '{}',
      capture_context_json: null,
      diagnostic_score: 10,
      gate_pass: 1,
      gate_failure_reason: null,
      failed_invariants_json: null,
      validation_status: 'promoted',
      rejection_reason: null,
    },
    artifact: {
      artifact_id: 'art_123',
      candidate_id: 'cand_123',
      project_id: 'proj_123',
      session_id: 'sess_123',
      dispatch_id: 'disp_123',
      validated_at: '2026-04-05T00:00:05.000Z',
      raw_text: 'Created src/example.ts\npnpm build\nExit code: 0',
      extracted_file_refs_json: '["src/example.ts","src/other.ts"]',
      git_correlation_json: null,
      validation_evidence_json: '{}',
      source: 'clipboard_validated',
      artifact_type: 'copilot_execution_narrative',
    },
    contract: {
      event_id: 'evt_contract_123',
      created_at: '2026-04-05T00:00:00.500Z',
      content: '{"summary":"contract input"}',
    },
    ...overrides,
  };
}

test('buildResolvedOutcomeSummary renders promoted outcomes from explicit links only', () => {
  const summary = buildResolvedOutcomeSummary(makeBundle());

  assert.equal(summary.outcome_status, 'success');
  assert.equal(summary.dispatch_id, 'disp_123');
  assert.equal(summary.candidate_id, 'cand_123');
  assert.equal(summary.contract_ref, 'evt_contract_123');
  assert.equal(summary.artifact_ref, 'art_123');
  assert.equal(summary.rejection_reason, null);
  assert.deepEqual(summary.affected_file_refs, ['src/example.ts', 'src/other.ts']);
  assert.match(summary.explanation, /promoted/i);
  assert.match(summary.summary_text, /outcome_status: success/);
  assert.match(summary.summary_text, /candidate_id: cand_123/);
  assert.match(summary.summary_text, /artifact_ref: art_123/);
  assert.match(summary.summary_text, /src\/example.ts/);
});

test('buildResolvedOutcomeSummary renders rejected outcomes without artifact refs', () => {
  const bundle = makeBundle({
    outcome: {
      outcome_id: 'out_456',
      project_id: 'proj_456',
      session_id: 'sess_456',
      dispatch_id: 'disp_456',
      candidate_id: 'cand_456',
      created_at: '2026-04-05T00:00:20.000Z',
      contract_ref: 'evt_contract_456',
      artifact_ref: null,
      verification_ref: null,
      rejection_reason: 'file_refs.length >= 1 (resolved within workspace)',
      outcome_summary: 'candidate rejected',
      outcome_status: 'failed',
      source: 'auto',
    },
    candidate: {
      candidate_id: 'cand_456',
      project_id: 'proj_456',
      session_id: 'sess_456',
      dispatch_id: 'disp_456',
      contract_ref: 'evt_contract_456',
      captured_at: '2026-04-05T00:00:11.000Z',
      source: 'clipboard',
      raw_text: 'Invalid content with no explicit file refs',
      content_hash: 'sha256_def',
      signal_flags_json: '{}',
      capture_context_json: null,
      diagnostic_score: 1,
      gate_pass: 0,
      gate_failure_reason: 'file_refs.length >= 1 (resolved within workspace)',
      failed_invariants_json: '["file_refs.length >= 1 (resolved within workspace)"]',
      validation_status: 'rejected',
      rejection_reason: 'file_refs.length >= 1 (resolved within workspace)',
    },
    artifact: null,
  });

  const summary = buildResolvedOutcomeSummary(bundle);

  assert.equal(summary.outcome_status, 'failed');
  assert.equal(summary.dispatch_id, 'disp_456');
  assert.equal(summary.candidate_id, 'cand_456');
  assert.equal(summary.contract_ref, 'evt_contract_456');
  assert.equal(summary.artifact_ref, null);
  assert.equal(summary.rejection_reason, 'file_refs.length >= 1 (resolved within workspace)');
  assert.deepEqual(summary.affected_file_refs, []);
  assert.match(summary.explanation, /rejected/i);
  assert.match(summary.explanation, /file_refs.length >= 1/);
  assert.match(summary.summary_text, /artifact_ref: none/);
  assert.match(summary.summary_text, /affected_file_refs:/);
  assert.match(summary.summary_text, /rejection_reason: file_refs.length >= 1/);
});
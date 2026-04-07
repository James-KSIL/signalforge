const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

function loadRenderer() {
  try {
    return require('../dist/artifacts/deterministicAdrRenderer.js');
  } catch (error) {
    throw new Error(
      'Unable to load ../dist/artifacts/deterministicAdrRenderer.js. Build @signalforge/core first with: pnpm --filter @signalforge/core run build\n' +
      String(error && error.message ? error.message : error)
    );
  }
}

const { buildDeterministicAdrV1 } = loadRenderer();

function expectedAdrId(source) {
  return `adr_v1_${createHash('sha256').update(source).digest('hex').slice(0, 16)}`;
}

function buildPromotedInput() {
  return {
    outcome: {
      outcome_id: 'outcome-001',
      project_id: 'signalforge',
      session_id: 'session-001',
      dispatch_id: 'dispatch-001',
      candidate_id: 'candidate-001',
      created_at: '2026-04-06T00:00:00.000Z',
      contract_ref: 'contract://dispatch-001',
      artifact_ref: 'artifact-001',
      verification_ref: null,
      rejection_reason: null,
      outcome_summary: 'validated',
      outcome_status: 'success',
      source: 'auto',
    },
    candidate: {
      candidate_id: 'candidate-001',
      project_id: 'signalforge',
      session_id: 'session-001',
      dispatch_id: 'dispatch-001',
      contract_ref: 'contract://dispatch-001',
      captured_at: '2026-04-06T00:00:00.000Z',
      source: 'clipboard',
      raw_text: 'Candidate raw text',
      content_hash: 'hash-001',
      signal_flags_json: JSON.stringify({
        executionSignals: {
          build_command_detected: false,
        },
      }),
      capture_context_json: null,
      diagnostic_score: 10,
      gate_pass: 1,
      gate_failure_reason: null,
      failed_invariants_json: JSON.stringify([]),
      validation_status: 'promoted',
      rejection_reason: null,
    },
    artifact: {
      artifact_id: 'artifact-001',
      candidate_id: 'candidate-001',
      project_id: 'signalforge',
      session_id: 'session-001',
      dispatch_id: 'dispatch-001',
      validated_at: '2026-04-06T00:00:00.000Z',
      raw_text: 'Artifact raw text',
      extracted_file_refs_json: JSON.stringify([
        'packages/core/src/artifacts/deterministicAdrRenderer.ts',
        'apps/vscode-extension/src/extension.ts',
      ]),
      git_correlation_json: null,
      validation_evidence_json: JSON.stringify({
        contract_gate: {
          executionSignals: {
            build_command_detected: true,
            test_result_detected: true,
            command_outcome_line_detected: true,
          },
        },
      }),
      source: 'clipboard_validated',
      artifact_type: 'copilot_execution_narrative',
    },
    contract: {
      event_id: 'evt-contract-001',
      created_at: '2026-04-06T00:00:00.000Z',
      content: JSON.stringify({
        summary: 'file_refs.length >= 1 and execution_signals_count >= 1',
      }),
    },
  };
}

function buildRejectedInput() {
  return {
    outcome: {
      outcome_id: 'outcome-002',
      project_id: 'signalforge',
      session_id: 'session-002',
      dispatch_id: 'dispatch-002',
      candidate_id: 'candidate-002',
      created_at: '2026-04-06T01:00:00.000Z',
      contract_ref: 'contract://dispatch-002',
      artifact_ref: null,
      verification_ref: null,
      rejection_reason: 'execution_signals_count >= 1',
      outcome_summary: 'rejected',
      outcome_status: 'failed',
      source: 'auto',
    },
    candidate: {
      candidate_id: 'candidate-002',
      project_id: 'signalforge',
      session_id: 'session-002',
      dispatch_id: 'dispatch-002',
      contract_ref: 'contract://dispatch-002',
      captured_at: '2026-04-06T01:00:00.000Z',
      source: 'clipboard',
      raw_text: 'Candidate raw text',
      content_hash: 'hash-002',
      signal_flags_json: JSON.stringify({
        executionSignals: {
          build_command_detected: false,
          test_result_detected: false,
          command_outcome_line_detected: false,
        },
      }),
      capture_context_json: null,
      diagnostic_score: 2,
      gate_pass: 0,
      gate_failure_reason: 'execution_signals_count >= 1',
      failed_invariants_json: JSON.stringify([
        'execution_signals_count >= 1',
        'file_refs.length >= 1 (resolved within workspace)',
      ]),
      validation_status: 'rejected',
      rejection_reason: 'execution_signals_count >= 1',
    },
    artifact: null,
    contract: {
      event_id: 'evt-contract-002',
      created_at: '2026-04-06T01:00:00.000Z',
      content: JSON.stringify({
        summary: 'execution_signals_count >= 1',
      }),
    },
  };
}

test('promoted ADR uses candidate_id + artifact_id and includes artifact evidence', () => {
  const input = buildPromotedInput();
  const rendered = buildDeterministicAdrV1(input);

  assert.equal(rendered.decision, 'PROMOTED');
  assert.equal(rendered.adr_id, expectedAdrId('candidate-001|artifact-001'));
  assert.match(rendered.markdown, /- artifact_ref: artifact-001/);
  assert.match(rendered.markdown, /- file_refs:/);
  assert.match(rendered.markdown, /apps\/vscode-extension\/src\/extension.ts/);
  assert.match(rendered.markdown, /packages\/core\/src\/artifacts\/deterministicAdrRenderer.ts/);
});

test('rejected ADR uses candidate_id + outcome_id and includes rejection reason', () => {
  const input = buildRejectedInput();
  const rendered = buildDeterministicAdrV1(input);

  assert.equal(rendered.decision, 'REJECTED');
  assert.equal(rendered.adr_id, expectedAdrId('candidate-002|outcome-002'));
  assert.match(rendered.markdown, /- artifact_ref: null/);
  assert.match(rendered.markdown, /  - gate_pass: false/);
  assert.match(rendered.markdown, /  - failed_invariants: \["execution_signals_count >= 1", "file_refs.length >= 1 \(resolved within workspace\)"\]/);
  assert.match(rendered.markdown, /  - gate_failure_reason: execution_signals_count >= 1/);
  assert.match(rendered.markdown, /- rejection_reason: execution_signals_count >= 1/);
  assert.match(rendered.markdown, /- file_refs: \[\]/);
  assert.match(rendered.markdown, /- candidate rejected; no artifact created/);
});

test('determinism: same input renders exact output and adr_id', () => {
  const input = buildPromotedInput();
  const renderedA = buildDeterministicAdrV1(input);
  const renderedB = buildDeterministicAdrV1(input);

  assert.equal(renderedA.adr_id, renderedB.adr_id);
  assert.equal(renderedA.markdown, renderedB.markdown);
  assert.equal(renderedA.markdown.includes('none'), false);
});

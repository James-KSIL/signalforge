const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  passesContractGate,
  extractFileReferences,
} = require('../dist/validation/copilotValidationService.js');

function mkWorkspace() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-core-gate-'));
  return {
    workspaceRoot,
    cleanup() {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    },
  };
}

function baseCandidate(overrides = {}) {
  return {
    candidate_id: 'cand_unit',
    project_id: 'proj_unit',
    session_id: 'sess_unit',
    dispatch_id: 'disp_unit',
    captured_at: '2026-04-05T00:00:00.000Z',
    source: 'clipboard',
    raw_text: 'Created src/main.ts\npnpm build\nExit code: 0',
    content_hash: 'sha256_test_hash',
    signal_flags: {},
    capture_context: {},
    ...overrides,
  };
}

test('passesContractGate: passes when invariants are satisfied', () => {
  const { workspaceRoot, cleanup } = mkWorkspace();
  try {
    fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'src', 'main.ts'), 'export const ok = true;\n', 'utf8');

    const result = passesContractGate(baseCandidate(), { workspaceRoot });

    assert.equal(result.gatePass, true);
    assert.equal(result.failedInvariants.length, 0);
    assert.equal(result.gateFailureReason, null);
    assert.ok(result.executionSignals.build_command_detected);
    assert.ok(result.executionSignals.command_outcome_line_detected);
    assert.ok(result.executionSignalsCount >= 1);
    assert.deepEqual(result.resolvedWorkspaceFiles, ['src/main.ts']);
  } finally {
    cleanup();
  }
});

test('execution signal extraction is reflected in gate output', () => {
  const { workspaceRoot, cleanup } = mkWorkspace();
  try {
    fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'src', 'main.ts'), 'export const ok = true;\n', 'utf8');

    const result = passesContractGate(
      baseCandidate({
        raw_text: 'Updated src/main.ts\npytest\n2 passed',
      }),
      { workspaceRoot }
    );

    assert.equal(result.gatePass, true);
    assert.equal(result.executionSignals.build_command_detected, true);
    assert.equal(result.executionSignals.test_result_detected, true);
    assert.equal(result.executionSignalsCount >= 1, true);
  } finally {
    cleanup();
  }
});

test('file ref extraction normalizes paths and workspace bounding blocks traversal', () => {
  const refs = extractFileReferences('Modified "C:\\repo\\src\\main.ts" and ../../outside/evil.ts');
  assert.ok(refs.includes('repo/src/main.ts'));
  assert.ok(refs.includes('../../outside/evil.ts'));

  const { workspaceRoot, cleanup } = mkWorkspace();
  try {
    fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'src', 'allowed.ts'), 'export const ok = true;\n', 'utf8');

    const outsideDir = path.resolve(workspaceRoot, '..', 'outside');
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, 'evil.ts'), 'export const nope = true;\n', 'utf8');

    const result = passesContractGate(
      baseCandidate({
        raw_text: 'Changed ../../outside/evil.ts\npnpm build\nExit code: 0',
      }),
      { workspaceRoot }
    );

    assert.equal(result.gatePass, false);
    assert.deepEqual(result.resolvedWorkspaceFiles, []);
    assert.ok(result.failedInvariants.includes('file_refs.length >= 1 (resolved within workspace)'));
  } finally {
    cleanup();
  }
});

test('content hash is required by contract gate', () => {
  const { workspaceRoot, cleanup } = mkWorkspace();
  try {
    fs.mkdirSync(path.join(workspaceRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'src', 'main.ts'), 'export const ok = true;\n', 'utf8');

    const result = passesContractGate(
      baseCandidate({
        content_hash: null,
        raw_text: 'Created src/main.ts\npnpm build\nExit code: 0',
      }),
      { workspaceRoot }
    );

    assert.equal(result.gatePass, false);
    assert.ok(result.failedInvariants.includes('content_hash !== null'));
  } finally {
    cleanup();
  }
});

test('gate failure reason emits first failed invariant deterministically', () => {
  const { workspaceRoot, cleanup } = mkWorkspace();
  try {
    const result = passesContractGate(
      baseCandidate({
        source: '',
        content_hash: null,
        raw_text: 'No technical evidence in this prose.',
      }),
      { workspaceRoot }
    );

    assert.equal(result.gatePass, false);
    assert.equal(result.gateFailureReason, 'file_refs.length >= 1 (resolved within workspace)');
  } finally {
    cleanup();
  }
});

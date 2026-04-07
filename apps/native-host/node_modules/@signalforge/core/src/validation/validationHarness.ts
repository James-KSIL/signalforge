import { validateCopilotCandidate, CopilotCandidatePayload, ValidationContext } from './copilotValidationService';

type HarnessCase = {
  id: string;
  label: string;
  expected: 'positive' | 'negative';
  payload: CopilotCandidatePayload;
  context: ValidationContext;
};

function buildPayload(id: string, rawText: string, projectId = 'proj_signalforge', sessionId = 'sess_active_01'): CopilotCandidatePayload {
  return {
    candidate_id: `cand_${id}`,
    project_id: projectId,
    session_id: sessionId,
    dispatch_id: 'dsp_sess_active_01',
    captured_at: new Date().toISOString(),
    source: 'clipboard',
    raw_text: rawText,
    signal_flags: {
      threshold_passed: true,
    },
    capture_context: {
      source_url: 'https://chatgpt.com/c/test-thread',
      selection_type: 'manual',
      chat_id: 'test-thread',
    },
  };
}

function mkPositiveText(fileA: string, fileB: string): string {
  return [
    'What I changed',
    `- Implemented deterministic validator in ${fileA}`,
    `- Updated repository writes in ${fileB}`,
    'Exact files changed: src/services/ingestService.ts, packages/core/src/validation/copilotValidationService.ts',
    'Build status: build passed',
    'Ran terminal command: pnpm --filter ./apps/native-host run build',
    '```diff',
    '+ add staging and canonical promotion checks',
    '```',
    'Files changed summary includes validation reasons and event emission.',
  ].join('\n');
}

function mkNegativeText(seed: number): string {
  return `General architecture idea ${seed}: we should think about software quality and maybe improve process with future planning.`;
}

function generateCases(): HarnessCase[] {
  const workspaceFiles = [
    'apps/native-host/src/services/ingestService.ts',
    'packages/core/src/validation/copilotValidationService.ts',
    'packages/core/src/repositories/copilotCandidateRepository.ts',
    'packages/core/src/repositories/copilotArtifactRepository.ts',
    'apps/chrome-extension/src/content/content.bundle.ts',
    'packages/core/src/storage/schema.ts',
    'apps/native-host/src/main.ts',
    'packages/core/src/storage/db.ts',
  ];

  const modifiedFiles = [
    'apps/native-host/src/services/ingestService.ts',
    'packages/core/src/validation/copilotValidationService.ts',
    'packages/core/src/repositories/copilotCandidateRepository.ts',
    'packages/core/src/repositories/copilotArtifactRepository.ts',
    'apps/chrome-extension/src/content/content.bundle.ts',
    'packages/core/src/storage/schema.ts',
  ];

  const sharedContext: ValidationContext = {
    workspaceRoot: process.cwd(),
    workspaceFiles,
    gitModifiedFiles: modifiedFiles,
    buildSignals: ['build passed'],
  };

  const cases: HarnessCase[] = [];

  for (let i = 1; i <= 20; i += 1) {
    cases.push({
      id: `tp_${i}`,
      label: 'true-positive narrative',
      expected: 'positive',
      payload: buildPayload(`tp_${i}`, mkPositiveText('apps/native-host/src/services/ingestService.ts', 'packages/core/src/storage/schema.ts')),
      context: sharedContext,
    });
  }

  for (let i = 1; i <= 20; i += 1) {
    cases.push({
      id: `fp_${i}`,
      label: 'false-positive technical prose',
      expected: 'negative',
      payload: buildPayload(`fp_${i}`, mkNegativeText(i)),
      context: sharedContext,
    });
  }

  for (let i = 1; i <= 12; i += 1) {
    const text = [
      'What I changed',
      '- Implemented updates in docs/architecture/notes.md',
      'Exact files changed: docs/architecture/notes.md',
      'Build status: build passed',
      'Ran terminal command: pnpm run build',
    ].join('\n');

    cases.push({
      id: `edge_wrong_project_${i}`,
      label: 'edge wrong project paths',
      expected: 'negative',
      payload: buildPayload(`edge_wrong_project_${i}`, text),
      context: {
        ...sharedContext,
        workspaceFiles,
        gitModifiedFiles: modifiedFiles,
      },
    });
  }

  for (let i = 1; i <= 8; i += 1) {
    const shortValidish = [
      'What I changed',
      '- Fixed apps/chrome-extension/src/content/content.bundle.ts',
      'Build status: build passed',
    ].join('\n');

    cases.push({
      id: `edge_short_${i}`,
      label: 'edge short narrative',
      expected: 'negative',
      payload: buildPayload(`edge_short_${i}`, shortValidish),
      context: sharedContext,
    });
  }

  return cases;
}

export function runValidationHarness() {
  const cases = generateCases();

  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  const failures: Array<{ id: string; expected: string; actual: string; reasons: string[] }> = [];

  for (const testCase of cases) {
    const result = validateCopilotCandidate(testCase.payload, testCase.context);
    const predicted = result.ok ? 'positive' : 'negative';

    if (testCase.expected === 'positive' && predicted === 'positive') tp += 1;
    else if (testCase.expected === 'negative' && predicted === 'negative') tn += 1;
    else if (testCase.expected === 'negative' && predicted === 'positive') {
      fp += 1;
      failures.push({ id: testCase.id, expected: testCase.expected, actual: predicted, reasons: result.reasons });
    } else {
      fn += 1;
      failures.push({ id: testCase.id, expected: testCase.expected, actual: predicted, reasons: result.reasons });
    }
  }

  const total = cases.length;
  const falsePositiveRate = (fp / Math.max(1, fp + tn)) * 100;
  const falseNegativeRate = (fn / Math.max(1, fn + tp)) * 100;

  const summary = {
    total,
    tp,
    tn,
    fp,
    fn,
    falsePositiveRate,
    falseNegativeRate,
    precision: tp / Math.max(1, tp + fp),
    recall: tp / Math.max(1, tp + fn),
    failures: failures.slice(0, 10),
  };

  return summary;
}

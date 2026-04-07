import { runValidationHarness } from '@signalforge/core/dist/validation/validationHarness';

export function runCopilotValidationHarness(): {
  total: number;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  precision: number;
  recall: number;
  failures: Array<{ id: string; expected: string; actual: string; reasons: string[] }>;
} {
  return runValidationHarness();
}

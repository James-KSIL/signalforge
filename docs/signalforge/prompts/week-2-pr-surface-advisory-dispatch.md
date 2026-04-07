# Dispatch Prompt - Week 2 PR Surface (Advisory)

Implement Week 2 for SignalForge by moving the current local deterministic validator onto pull request surface as advisory-only feedback.

## Baseline (Must Preserve)

- Keep `signalforge.yaml` as single source of truth.
- Keep deterministic evaluation only.
- Keep exact constraint matching only (no NLP or fuzzy logic).
- Keep local CLI behavior and output contract (`SAFE` / `NOT SAFE`) unchanged.

## Week 2 Objective

On pull requests, execute `npx tsx scripts/sf-validate.ts` and surface outcome as non-blocking signal.

## Requirements

1. Trigger on pull requests.
2. Run validation using repository `signalforge.yaml`.
3. Surface output as one of:
- PR comment
- check run status/details
4. Advisory mode only:
- does not fail required checks
- does not block merge
5. Preserve deterministic output content.

## Non-Goals

- no AI-driven interpretation
- no auto-remediation
- no generalized constraint engine
- no UI/dashboard work

## Acceptance Criteria

1. A pull request shows SignalForge validation result.
2. Result clearly communicates `SAFE` or `NOT SAFE`.
3. Violations (if any) are surfaced verbatim.
4. Merge remains unblocked regardless of result.
5. Existing local CLI command continues to work unchanged.

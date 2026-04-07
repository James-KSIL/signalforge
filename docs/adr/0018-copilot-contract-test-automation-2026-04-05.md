# ADR 0018: Copilot Contract Test Automation and Qualitative Validation Results

- Date: 2026-04-05
- Status: Accepted
- Scope: Deterministic contract verification for copilot candidate gate and ingest promotion pipeline

## Context

Manual flight testing for candidate ingestion and promotion was repetitive and non-deterministic. The contract requires automated verification for:

- Gate logic and invariant outputs
- Staging persistence fields
- Promotion/rejection behavior
- Fixture-driven ingest outcomes for expected pass/fail cases

Constraints applied:

- Invariants must not be weakened
- Promotion assertions must not depend on diagnostic score
- Production logic changes must be minimal and only for testability
- Integration tests must use temp SQLite databases
- Tests must be deterministic, non-interactive, and avoid browser/VS Code UI automation

## Decision

Introduce deterministic Node-based automated tests covering both unit and integration surfaces.

Test assets added:

- packages/core/test/copilotContractGate.unit.test.cjs
- apps/native-host/test/copilotIngest.contract.integration.test.cjs
- apps/native-host/test/fixtures/copilot-ingest-fixtures.json

Minimal production refactor added for testability only:

- apps/native-host/src/services/ingestService.ts
  - Added source normalization helper so malformed non-string source values are normalized to empty string and fail gate deterministically
  - Added content hash resolver with guarded test-only override path
  - Default behavior is compute-from-raw-text; override is impossible unless both controls are true:
    - explicit env flag SIGNALFORGE_ALLOW_CONTENT_HASH_OVERRIDE=1
    - process is a test runner context (Node test worker marker or recognized test runner environment)
  - Override path is treated as a controlled breach point and must not be enabled for chrome extension flow, native host runtime, or production deployments

Guardrail classification:

- Controlled backdoor for deterministic invariant testing only
- Not a convenience feature and not part of normal runtime behavior
- Any widening of activation conditions is considered a security regression against core invariant enforcement

## Test Coverage Implemented

### 1. Unit Tests (Gate/Validation Surface)

Implemented in packages/core/test/copilotContractGate.unit.test.cjs.

Cases covered:

- passesContractGate() pass path when all invariants are satisfied
- Execution signal extraction behavior through gate output fields
- File ref extraction normalization plus workspace-bounded resolution behavior
- Content hash requirement invariant
- Gate failure reason output is deterministic and emits first failed invariant

### 2. Repository/Integration Tests (SQLite + Ingest Flow)

Implemented in apps/native-host/test/copilotIngest.contract.integration.test.cjs.

Cases covered:

- Staging insert persists required fields:
  - content_hash
  - diagnostic_score
  - gate_pass
  - gate_failure_reason
  - failed_invariants_json
- Promotion inserts into copilot_execution_artifacts only when gate_pass is true
- Rejection leaves candidate staged and not promoted

Test method:

- Use real handleInbound() flow in native host ingest service
- Use per-test temp workspace and per-test temp SQLite db path (SIGNALFORGE_DB_PATH)
- Bootstrap workspace authority so file-ref resolution remains deterministic and bounded

### 3. Fixture-Driven Ingest Tests

Implemented via apps/native-host/test/fixtures/copilot-ingest-fixtures.json and executed by integration harness.

Fixtures covered:

- valid candidate fixture => promoted
- high diagnostic score but zero execution signals => rejected
- zero valid file refs => rejected
- null source => rejected
- null content_hash => rejected

## Commands

Build command used before integration execution:

- pnpm --filter ./apps/native-host run build

Deterministic test execution command:

- node --test packages/core/test/copilotContractGate.unit.test.cjs apps/native-host/test/copilotIngest.contract.integration.test.cjs

## Qualitative Results

Observed from deterministic run:

- Total tests: 10
- Pass: 10
- Fail: 0

Qualitative assessment:

- Contract gate behavior is now regression-protected at invariant level, including explicit failure-reason ordering
- Promotion safety is verified end-to-end against real staging/promotion tables under temp SQLite
- Rejection handling is verified to preserve staged records for auditability while preventing promotion
- Fixture corpus validates expected real-world boundary cases without introducing nondeterministic dependencies
- Promotion assertions remain independent of score-based heuristics, preserving contract intent

## Consequences

Positive:

- Replaces repeated manual flight checks with deterministic, scriptable verification
- Increases confidence that future changes cannot silently bypass gate or promote invalid candidates
- Preserves strict invariant model while enabling malformed-input simulation in controlled test mode

Tradeoffs:

- Small testability hook added to ingest service (dual-gated content hash override)
- Native-host build step is required before running integration tests against dist runtime

## Operational Notes

- Keep SIGNALFORGE_ALLOW_CONTENT_HASH_OVERRIDE limited to test execution contexts
- Never set SIGNALFORGE_ALLOW_CONTENT_HASH_OVERRIDE in Chrome extension, native host runtime launch profiles, or production environment configuration
- Keep fixture corpus under source control and extend with newly discovered adversarial patterns
- Continue validating both unit gate behavior and integration promotion behavior together for release checks

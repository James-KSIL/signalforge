# ADR 0019: Outcome Linking Post-Validation Lifecycle Correction

- Date: 2026-04-05
- Status: Accepted
- Scope: Deterministic outcome linkage for copilot candidate promotion and rejection

## Context

SignalForge now has a stable deterministic contract gate and verified promotion/rejection behavior. The next integrity boundary was outcome linkage: ensuring outcome_log rows are written only after validation has resolved, and that those rows carry explicit causal identifiers rather than inferred joins.

The previous lifecycle was incorrect:

- artifact_bound was treated as a final-resolution event
- outcome_auto_logged fired too early
- candidate validation had not necessarily completed when the outcome row was written
- artifact_ref and other linkage fields could be missing or incomplete

This created a causal gap in the evidence chain. SignalForge must remain a deterministic evidence compiler, not a heuristic linker.

Constraints applied:

- No time-based correlation
- No heuristic backfill
- No inferred joins across candidate, artifact, or outcome records
- artifact_ref must be required only for promoted outcomes
- rejected outcomes remain legitimate final outcomes with artifact_ref = null
- final outcome rows must not be emitted before validation resolution
- outcome rows should be final emissions, not patched-in incomplete receipts

## Decision

Move outcome generation from artifact_bound processing to post-validation resolution.

Outcome rows are now emitted only after the candidate has been classified as promoted or rejected.

The required linkage rule is explicit:

- candidate_id must always be present
- dispatch_id must always be present
- contract_ref must always be present
- artifact_ref must be present for promoted outcomes
- artifact_ref must be null for rejected outcomes
- rejection_reason must be populated for rejected outcomes

The outcome linkage path now uses explicit IDs propagated through the pipeline rather than inferred from timestamps or later lookup heuristics.

## Implementation Summary

### Production changes

Implemented in the ingest and storage layers:

- apps/native-host/src/services/ingestService.ts
  - outcome emission moved to the post-validation branch
  - promoted candidates emit a final outcome row after artifact insertion and validation resolution
  - rejected candidates emit a final outcome row after rejection status is resolved
  - explicit contract_ref is propagated through candidate capture into outcome emission
  - rejection_reason is carried into outcome rows for rejected paths

- packages/core/src/storage/schema.ts
  - outcome_logs now includes candidate_id and rejection_reason
  - copilot_candidate_staging now includes contract_ref for explicit linkage propagation

- packages/core/src/storage/db.ts
  - added ALTER TABLE backfills for existing SQLite databases

- packages/core/src/repositories/copilotCandidateRepository.ts
  - candidate staging insert/update now persists contract_ref

- packages/core/src/repositories/outcomeLogRepository.ts
  - outcome_log insert now persists candidate_id and rejection_reason

- packages/core/src/validation/copilotValidationService.ts
  - candidate payload now accepts explicit contract_ref

- packages/core/src/ingestion/ingestArtifactBound.ts
  - legacy outcome generation at artifact_bound time removed
  - artifact_bound remains a processing signal only, not a final-resolution signal

### Test coverage added

Implemented in apps/native-host/test/outcomeLinking.integration.test.cjs.

Cases covered:

- promoted outcome linkage
  - no outcome row before validation resolution
  - outcome_log contains dispatch_id, candidate_id, contract_ref, artifact_ref
  - artifact_ref points to the promoted artifact row

- rejected outcome linkage
  - no outcome row before validation resolution
  - outcome_log contains dispatch_id, candidate_id, contract_ref
  - artifact_ref is null
  - rejection_reason is populated

- early-emission guard
  - artifact_bound alone does not create a final outcome_log row

Regression verification also passed against existing contract-gate and native-host ingest coverage.

## Commands

Build command used for verification:

- pnpm -r build

Deterministic test execution command:

- node --test I:\SignalForge\packages\core\test\copilotContractGate.unit.test.cjs I:\SignalForge\apps\native-host\test\copilotIngest.contract.integration.test.cjs I:\SignalForge\apps\native-host\test\outcomeLinking.integration.test.cjs

## Qualitative Results

Observed from deterministic runs:

- Outcome-linking tests: pass
- Contract gate unit tests: pass
- Native-host ingest integration tests: pass
- Total observed tests in combined regression run: 13
- Pass: 13
- Fail: 0

Qualitative assessment:

- Outcome logs are now causally aligned with validation resolution
- Promotion and rejection both produce final, deterministic outcome rows
- artifact_bound no longer acts as a premature receipt-writing event
- The evidence chain now preserves explicit lineage from candidate to outcome
- Downstream ADR, summary, and reporting generation can trust the provenance boundary

## Consequences

Positive:

- Eliminates a lifecycle ordering bug that caused incomplete outcome rows
- Strengthens evidence integrity by making outcome rows final and causally correct
- Makes promoted and rejected paths uniformly deterministic and audit-friendly
- Preserves rejected outcomes as valid final records without requiring artifact_ref

Tradeoffs:

- Explicit ID propagation required additional schema and repository updates
- Existing SQLite databases need backfill support for the new linkage columns
- artifact_bound is now strictly an intermediate signal, which reduces its role but improves semantic clarity

## Operational Notes

- Keep outcome emission exclusively in post-validation branches
- Do not reintroduce inferred joins or timestamp correlation for outcome linkage
- Do not patch incomplete early outcome rows if final emission can be written instead
- Keep artifact_bound semantically separate from validation resolution
- Extend this linkage contract carefully if additional final outcome types are introduced

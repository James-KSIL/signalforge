# Phase 2 — Semantic Enrichment: What was proposed and what was implemented

Date: 2026-03-30

## Proposed
- Define a canonical event schema that codifies event role, type, and structured content.
- Enforce event creation integrity and add guardrails so every event answers: what happened + why it matters.
- Convert outcome logging to structured input that becomes `outcome_logged` events.
- Produce deterministic ADRs and session summaries derived from enriched events.

## Implemented
- Canonical types: `packages/core/src/events/event.types.ts` — `ForgeEvent`, `EventContent`, `EventRole`, `EventType`.
- Creation guardrail: `packages/core/src/events/helpers.ts` — `createEvent()`, `generateId()`, `normalizeRole()`; throws on missing `content.summary` or `thread_id`.
- Outcome conversion: `packages/core/src/events/outcome.ts` — `OutcomeInput` and `buildOutcomeEvent()` produce structured `outcome_logged` events.
- ADR generator: `packages/core/src/artifacts/adrGenerator.ts` — `buildADR(events)` aggregates outcomes into an ADR with engineering statements.
- Session summary: `packages/core/src/sessions/sessionSummary.ts` — highlights formatted as `- [status] summary` to read like a standup log.
- Dispatch compiler hardening: `packages/core/src/dispatch/dispatchCompiler.ts` — parses legacy content, normalizes roles, validates content, and writes enriched artifacts.

## Developer impact
- Downstream consumers should rely on `EventContent.summary` and optional `details`, `status`, and `artifacts` fields.
- Any code paths that previously wrote loosely-shaped event blobs should be migrated to call `createEvent()` or to provide `content.summary` at minimum.

## Next recommended steps
- Run a TypeScript build and add unit tests validating guardrails and ADR/session outputs.
- Migrate any remaining loose event writers in `packages/core/src` to `createEvent()`.

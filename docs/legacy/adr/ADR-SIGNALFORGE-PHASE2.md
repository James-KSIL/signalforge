# ADR: SIGNALFORGE-PHASE2-SEMANTIC-LAYER

Date: 2026-03-30

## Status
Accepted and implemented in code (packages/core/src).

## Context
SignalForge previously recorded events as loosely structured records. For decision-grade artifacts and reproducible engineering workflows we need events that always answer: what happened and why it matters. This ADR captures the Phase 2 decision to introduce a semantic enrichment layer: a canonical event schema, strict creation guards, normalized roles, and artifact intelligence (ADR/session generators).

## Decision
- Introduce a canonical `ForgeEvent` schema (`packages/core/src/events/event.types.ts`) with typed `EventRole`, `EventType`, and `EventContent`.
- Enforce event integrity via a single `createEvent()` helper (`packages/core/src/events/helpers.ts`) that guarantees `event_id`, `thread_id`, `role`, `event_type`, `content.summary`, and `timestamp`.
- Normalize incoming role values to a whitelist using `normalizeRole()` to prevent undefined/dynamic role propagation.
- Treat outcomes as first-class events using `OutcomeInput` → `buildOutcomeEvent()` to convert structured outcome reports into `outcome_logged` events.
- Provide deterministic artifact generation: `buildADR(events)` and `buildSessionSummary(events)` produce engineering-focused, machine- and human-readable outputs.

## Rationale
- Deterministic IDs and timestamps plus strict content guards eliminate noisy or incomplete records that break analytics and downstream automation.
- A typed schema enables static checks, clearer repository contracts, and safer migrations.
- Normalized roles and structured outcomes make it straightforward to programmatically extract decisions and outcomes for ADRs, changelogs, and release notes.

## Implementation Notes
- Files added: `packages/core/src/events/event.types.ts`, `packages/core/src/events/helpers.ts`, `packages/core/src/events/outcome.ts`, `packages/core/src/artifacts/adrGenerator.ts`, `packages/core/src/sessions/sessionSummary.ts`.
- Existing `dispatchCompiler.ts` updated to parse legacy event content, normalize roles, validate content summaries, and output enriched contract/prompt/copilot artifacts.

## Consequences
- Positive: Event enrichment layer makes SignalForge outputs decision-grade; ADRs now contain explicit engineering decisions and outcomes; session summaries read like concise standup logs.
- Negative: Consumers of legacy, loosely-typed event blobs must be adapted to read the new `EventContent` shape or pass through the `parseContent` compatibility layer.

## Acceptance Criteria
- No event passes into storage or into ADR/session generators without a non-empty `content.summary`.
- Roles are limited to `system`, `user`, `worker`, `observer`, `outcome`.
- ADR documents list real engineering decisions and outcome statuses.

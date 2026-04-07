# ADR: Runtime Path Unification for Artifact Generation

Date: April 1, 2026  
Status: Implemented

## Context

SignalForge produced a persistent artifact inconsistency:

- Event sections in generated ADR/session artifacts showed valid outcome events.
- Outcome Summary / Implementation Outcomes frequently reported:
  - renderedOutcomes: 0
  - Skipped Legacy/Invalid Outcomes: all

Root-cause tracing showed a runtime-path split:

- The VS Code extension commands for Generate ADR Draft and Generate Session Summary were not using core artifact generators.
- Extension command code rendered outcomes separately from outcomes table rows with extension-local normalization logic.
- Core fixes in outcome normalization and core generators did not reliably affect runtime artifact output from those extension commands.

## Decision

Unify runtime artifact generation by routing extension commands directly to core generators using the canonical event stream as source of truth.

### Implemented behavior

For both commands:

1. Load canonical event stream from chat_events via getChatEventsByThread.
2. Adapt DB rows to ForgeEvent shape in extension command path.
3. Call core generators directly:
   - buildADR(events)
   - buildSessionSummary(events)
4. Persist returned markdown into existing artifact locations.

## Scope of Change

Primary change file:

- apps/vscode-extension/src/extension.ts

Unification changes:

- Generate ADR Draft now calls core buildADR.
- Generate Session Summary now calls core buildSessionSummary.
- Extension-local duplicate outcome rendering path for ADR/session commands was removed/bypassed.
- Separate outcomes table rendering in ADR/session command path was removed.

Preserved:

- Command names
- Output locations
- Pinned project behavior
- Existing transparency of skipped-count reporting (now coming from core generators)

## Consequences

### Positive

- Single runtime source of truth for artifact generation.
- Core generator fixes now affect actual generated ADR/session outputs.
- Elimination of duplicate outcome rendering logic between extension and core for these commands.
- Outcome sections derive from the same canonical event stream visible in Events.

### Tradeoffs

- Extension ADR/session formatting now follows core generator output contract by design.
- Any future formatting changes should be made in core generators to remain unified.

## Validation

Build validation completed:

- npx tsc -p packages/core/tsconfig.json -> exit 0
- pnpm --filter ./apps/vscode-extension run build -> exit 0

Runtime verification path (manual flow):

1. Start Session
2. Seed Test Dispatch
3. Log Outcome
4. Generate ADR Draft
5. Generate Session Summary

Expected result after unification:

- Outcome sections populate from canonical event stream.
- renderedOutcomes > 0 when valid outcome events are present.
- No undefined/null/[object Object] output leakage in outcome fields.

## Follow-on Guidance

For artifact rendering issues, debug and modify core generators first, then verify extension command adapters preserve canonical event shape. This keeps runtime behavior deterministic and avoids split-path regressions.

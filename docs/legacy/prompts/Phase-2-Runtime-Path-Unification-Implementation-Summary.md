# Phase 2 Summary: Runtime Path Unification for ADR/Session Artifact Generation

## What was proposed

A source-level correction was proposed to eliminate the final artifact divergence bug:

- Stop extension commands from rendering ADR/session outcomes through extension-local duplicate logic.
- Make extension commands call core artifact generators directly.
- Use canonical event stream as the single runtime input for both Events and Outcome sections.

The goal was to ensure generated artifacts reflect one consistent pipeline and that core fixes are visible at runtime.

## What was implemented

Implementation completed in extension command flow:

- apps/vscode-extension/src/extension.ts

Changes applied:

1. Generate ADR Draft command now:
   - fetches chat events from chat_events
   - canonicalizes to ForgeEvent shape
   - invokes core buildADR(events)

2. Generate Session Summary command now:
   - fetches chat events from chat_events
   - canonicalizes to ForgeEvent shape
   - invokes core buildSessionSummary(events)

3. Separate extension-side Outcome Summary rendering from outcomes table in these command paths was removed.

4. Extension-local duplicate outcome normalization/rendering logic used by ADR/session command paths was removed/bypassed.

## Why this resolves the issue

Previously, runtime artifact output was controlled by extension-local code, while core fixes were applied to a different path. This made outcome fixes appear ineffective.

After unification:

- artifact generation path is singular
- source of truth is canonical event stream
- core generator behavior is the runtime behavior

## Outcomes

Expected observable outcomes:

- Outcome Summary / Implementation Outcomes populate when valid outcome events exist in events stream
- renderedOutcomes > 0 for valid outcome data
- no undefined
- no null
- no [object Object]
- skip counters remain transparent for malformed legacy rows

## Validation status

Build verification completed:

- npx tsc -p packages/core/tsconfig.json -> exit 0
- pnpm --filter ./apps/vscode-extension run build -> exit 0

Manual user-flow verification remains the final runtime confirmation step:

1. Start Session
2. Seed Test Dispatch
3. Log Outcome
4. Generate ADR Draft
5. Generate Session Summary

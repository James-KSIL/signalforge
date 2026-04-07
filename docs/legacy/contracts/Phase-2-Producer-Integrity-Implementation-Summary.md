# Phase 2 — Producer Integrity Enforcement

Date: 2026-04-01

## What was proposed
- Identify every write path to chat_events or equivalent event storage.
- Remove or refactor any raw event construction and direct writes that bypass canonical creation.
- Enforce strict producer-side validation so malformed events cannot enter storage.
- Require session and outcome flows to use approved wrappers.
- Add validation logging and hard failures for null content, missing summary, and invalid role values.

## What was implemented
1. Canonical enforcement tightened at event creation
- createEvent now rejects:
  - invalid roles
  - missing event_type
  - null or empty content.summary
  - undefined values nested in content

2. Persistence boundary hardened
- insertChatEvent now forwards producer role directly into canonical validation.
- Silent role fallback was removed so invalid role writes fail fast.
- Insert-path logging remains in place for traceability before persistence.

3. In-memory equivalent storage aligned with canonical rules
- Fallback event writes now pass through createEvent validation for chat_events inserts.
- This prevents in-memory mode from drifting from SQLite behavior.

4. Session and outcome flow integrity
- Session lifecycle continues to emit events through createSessionWithEvent and endSessionWithEvent.
- Outcome logging continues through insertOutcomeWithEvent and now normalizes legacy status aliases into canonical values.

5. Extension-side producer cleanup
- Seeded test dispatch event role adjusted to a canonical role.
- Outcome status picker narrowed to canonical values only.

## Outcome of this phase
- Source-level event writes are centralized through approved wrappers.
- Invalid role and null-content writes are blocked at runtime.
- Producer integrity is now prioritized over backward compatibility, matching phase intent.

## Validation performed
- pnpm --filter @signalforge/core run build
- pnpm --filter ./apps/native-host run build
- pnpm --filter ./apps/vscode-extension run build
- Runtime smoke test:
  - invalid role write blocked
  - null content write blocked

## Why this matters
Read-side cleanup alone can hide integrity problems. This phase moves enforcement to write-time so malformed events never become persisted state, improving reliability of ADR generation, session summaries, and downstream automation.

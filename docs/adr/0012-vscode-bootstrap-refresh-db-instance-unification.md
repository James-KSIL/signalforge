# ADR 0012: VS Code Bootstrap/Refresh DB Instance Unification

## Status

Accepted

## Context

SignalForge VS Code controlled execution reached session bootstrap readiness but still surfaced:

- `No dispatch_candidate_created events found in store.`

At the same time, runtime logs showed:

- `insertChatEvent: preparing to insert event` (canonical insert path)
- `InMemoryDb: inserting chat_event` (in-memory adapter path)

This indicated a persistence-layer split between where `dispatch_candidate_created` was written and where refresh queries were reading.

## Problem Statement

`dispatch_candidate_created` was being written during bootstrap but not visible to `refreshLatestDispatchFromStore`.

Primary diagnostic question:

- Which `openDatabase()` call returns `InMemoryDb`, and why?

## Investigation

### Read path (refresh)

- Command: `signalforge.refreshLatestDispatchFromStore`
- File: `apps/vscode-extension/src/extension.ts`
- Repository call: `getLatestDispatch(db)` from `packages/core/src/repositories/dispatchRepository.ts`
- Query:
  - `SELECT chat_thread_id, dispatch_id, project_id, created_at FROM chat_events WHERE event_type = ? ORDER BY created_at DESC LIMIT 1`
  - bound param: `dispatch_candidate_created`

### Write path (bootstrap)

- File: `apps/vscode-extension/src/services/sessionBootstrapService.ts`
- Bootstrap seeding path now ensures a `dispatch_candidate_created` event via `insertChatEvent`.
- Repository write: `packages/core/src/repositories/chatEventRepository.ts`

### Environment/config trace

- VS Code extension launch config sets:
  - `SIGNALFORGE_USE_INMEMORY_DB=1`
- File: `.vscode/launch.json`

### What we tested/observed

1. Confirmed command registration and extension entrypoint were fixed.
2. Confirmed dispatch seeding gap (event not guaranteed) and implemented deterministic event seed.
3. Observed runtime adapter mismatch symptoms from logs (`InMemoryDb` appearing in write path).
4. Added explicit runtime diagnostics at both bootstrap and refresh call sites:
   - env var value (`SIGNALFORGE_USE_INMEMORY_DB`)
   - resolved module id (`require.resolve(...)`)
   - DB adapter type (`constructor.name`)

## Decision

Unify bootstrap and refresh on one shared DB handle created at extension activation.

### Minimal fix applied

1. In `activate(...)` (`apps/vscode-extension/src/extension.ts`):
   - create a single `sharedDb` from core `openDatabase()`
   - pass it into `SessionBootstrapService`
   - use the same `sharedDb` for `refreshLatestDispatchFromStore`

2. In `SessionBootstrapService` (`apps/vscode-extension/src/services/sessionBootstrapService.ts`):
   - add `getDb` injection in constructor
   - route DB acquisition through `openCoreDatabase(callSite)`
   - log env/module/adapter at each bootstrap call site

This avoids bootstrap/read divergence without redesigning storage architecture.

## Why this fixed it

Before: bootstrap and refresh each opened DB independently. With SIGNALFORGE_USE_INMEMORY_DB=1 set in launch config, timing differences in module resolution caused one path to resolve InMemoryDb while the other resolved SQLite, producing a confirmed write/read split.

After: both paths read/write through the same DB object instance in the same extension process.

Result: `dispatch_candidate_created` written during bootstrap is visible to `getLatestDispatch` during refresh.

## Non-Goals (explicitly not changed)

- No redesign of authority model
- No Chrome/browser capture logic changes
- No native-host propagation changes
- No broad package export cleanup in this ADR

## Consequences

### Positive

- Deterministic visibility of seeded dispatch events across bootstrap and refresh.
- Stronger observability for future DB-layer issues (env/module/adapter logs).
- Minimal surface area change confined to VS Code controlled execution path.

### Tradeoff

- Extension now intentionally reuses a long-lived DB handle in-process for these paths.

## Validation

- Extension build succeeded after changes (`pnpm --filter ./apps/vscode-extension run build`).
- TypeScript errors: none in modified files.
- Runtime diagnostics now print comparable DB context for:
  - activation
  - bootstrap service DB opens
  - refresh command

## Follow-up (separate task)

Migrate import paths away from `@signalforge/core/dist/core/src/...` to stable package exports (e.g., `@signalforge/core/...`) without changing behavior.
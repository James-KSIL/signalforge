# Phase 2A — Implementation Summary

Date: 2026-03-29

This short summary maps the Phase 2A build contract (project pinning, project-aware routing, and a minimal sidebar) to what was proposed and what was implemented.

What was proposed

- Add project/session state in core and expose a stable project identity derivation utility.
- Detect workspace root and derive a stable project identity.
- Add VS Code commands for pin/unpin/show/materialize dispatchs.
- Provide a minimal sidebar that shows current workspace, pinned project status, latest dispatch id, and last materialization result.
- Prevent materialization when no pinned project exists and multiple possible targets exist.
- Keep the existing in-memory mode unchanged.

What was implemented

- Core
  - Extended schema: added `projects` and `sessions` DDL to the core schema file (`packages/core/src/storage/schema.ts`).
  - Updated initialization to apply both schemas (`packages/core/src/storage/db.ts`).
  - New lightweight `projectService` with `deriveProjectIdFromPath()` and best-effort DB registration (`packages/core/src/projects/projectService.ts`).

- Dispatch
  - `compileDispatch()` now accepts `options` with `targetDir` and `projectId`, writes artifacts into the target workspace, and emits a small `.meta.json` with `projectId`.

- VS Code extension
  - Commands added: `signalforge.pinProject`, `signalforge.unpinProject`, `signalforge.showLatestDispatch`, `signalforge.materializeLatestDispatch`.
  - Minimal `SignalForge` TreeView displays workspace, pinned project, latest dispatch, and last materialization result (`apps/vscode-extension/src/extension.ts`).
  - UI safety: materialization is blocked when multiple workspace folders exist and no project is pinned.

Acceptance criteria mapping

- User can pin the active workspace as the dispatch target — implemented via `signalforge.pinProject` and persisted in `globalState`.
- Latest dispatch can be materialized only into the correct pinned/current project — implemented via `compileDispatch(..., {targetDir, projectId})` and the extension materialize command.
- Sidebar shows active project state and latest dispatch status — implemented with the TreeView provider.
- No cross-project contamination in routing flow — ensured by targetDir writes and guard against ambiguous targets.
- Existing in-memory mode remains supported — `SIGNALFORGE_USE_INMEMORY_DB=1` still works.

Notes and next steps

- Add a dev/test helper command to set `latestDispatch` for easier interactive testing.
- Add unit/integration tests for `projectService` and dispatch materialization into `targetDir`.
- Improve project canonicalization (git root, remote URL) in a future phase.

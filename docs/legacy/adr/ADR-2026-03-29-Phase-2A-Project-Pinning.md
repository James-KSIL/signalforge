# ADR: Project Pinning and Project-Aware Dispatch Routing

- Date: 2026-03-29
- Status: Accepted / Implemented (Phase 2A)

## Context

SignalForge captures architecture reasoning and dispatch candidates in the browser and materializes repository-scoped handoff artifacts in VS Code. Until now, mapping a captured chat thread to a specific project was under-specified; this led to potential cross-project contamination when multiple workspaces are present or when browser-captured threads lacked a clear VS Code target.

## Decision

Implement explicit project pinning and project-aware dispatch routing in the VS Code extension and core sidecar, while keeping the in-memory fallback mode intact. Materialization should only proceed when a single target project is unambiguous (either explicitly pinned, or the workspace contains exactly one folder). Dispatch materialization will write artifacts into the target project's workspace (docs and .github), and small metadata will be emitted linking artifacts to the project id.

## Rationale

- Explicit pinning avoids accidental writes to the wrong repository when multiple workspace folders exist.
- A stable derived project identity (hash of workspace path) is a lightweight, deterministic identifier that avoids early sqlite migrations or remote coordination.
- Keeping the in-memory DB path and the SIGNALFORGE_USE_INMEMORY_DB fallback ensures developer workflows remain fast and safe.

## Consequences

- Positive
  - No cross-project contamination during materialization in normal workflows.
  - Clear user control via commands: `signalforge.pinProject` and `signalforge.unpinProject`.
  - Sidebar visibility of pinned state and latest dispatch increases UX transparency.

- Negative / Trade-offs
  - Project identity is derived from workspace path; identical repos opened from different paths will be treated as distinct projects until canonicalization (later improvement).
  - Manual pinning is required when multiple folders are open; automatic inference is intentionally out of scope for Phase 2A.

## Implementation Notes

- Core: added `projects` and `sessions` DDL to the core schema and a small `projectService` to derive project ids and best-effort register records.
- Dispatch compiler: `compileDispatch(chatThreadId, db, { targetDir?, projectId? })` writes artifacts into `targetDir` and emits a `.meta.json` linking the artifact to `projectId`.
- VS Code extension: added commands `signalforge.pinProject`, `signalforge.unpinProject`, `signalforge.showLatestDispatch`, `signalforge.materializeLatestDispatch` and a minimal `SignalForge` TreeView showing workspace, pinned project status, latest dispatch id, and last materialization result.
- Safety: materialization aborts if no pinned project exists and there are multiple workspace folders.

## Alternatives Considered

- Inferring project from browser payload alone — rejected because it is brittle and error-prone for multi-root workspaces.
- Requiring a full centralized projects registry — postponed to later phases to avoid early complexity.

## Status

This ADR is implemented in Phase 2A and serves as the canonical rationale for the current project pinning behavior. Future ADRs may refine project identity canonicalization, session lifecycle management, and persistent project registration.

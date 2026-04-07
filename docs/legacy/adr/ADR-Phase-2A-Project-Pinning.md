# ADR: Phase 2A — Project Pinning and Safe Materialization

Status: Accepted

Context
- During Phase 1 the SignalForge pipeline could materialize dispatch artifacts into the developer workspace without clear project-scoping. In multi-root workspaces this created risk of cross-project contamination when the extension could not deterministically choose a target.

Decision
- Introduce project pinning and a deterministic project identity derived from workspace path. Require an explicit pin when multiple workspace folders exist.
- Persist project records and sessions in the core sidecar database to allow stable association of artifacts and outcomes with project and session metadata.
- Modify the `compileDispatch` contract to accept `targetDir`, `projectId`, and `sessionId` and emit `.meta.json` alongside artifacts containing these associations.

Consequences
- Safe materialization: materialization operations are guarded by a pin or single-folder workspace; ambiguous operations are rejected until pinning is explicit.
- Traceability: artifacts and outcomes can be traced back to a project and session using persistent IDs.
- Developer ergonomics: quick commands were added to pin/unpin projects, start/end sessions, materialize, and generate artifacts (ADR, session summary, LinkedIn topics).
- Testability: seed/test commands were added so flows can be exercised locally without the full browser capture stack.

Implementation Notes
- New DB tables: `projects`, `sessions`, and `outcomes` were added to the core schema.
- New core helpers: `deriveProjectIdFromPath(workspacePath)` produces a deterministic stable id.
- Extension: commands in `apps/vscode-extension` include `signalforge.pinProject`, `signalforge.materializeLatestDispatch`, `signalforge.startSession`, `signalforge.endSession`, and artifact generators.
- Metadata: `compileDispatch(..., { targetDir, projectId, sessionId })` writes `.meta.json` with `projectId` and `sessionId`.

Status and Rationale
- This ADR was accepted and implemented because it reduces accidental cross-project writes and improves longitudinal traceability of outcomes and generated artifacts. It is intentionally minimal to unblock developer workflow and testing in Phase 2A.

Reviewed-by: SignalForge Team
Date: 2026-03-29

# ADR — Phase 3 Governed Context and Surface Expansion

Date: 2026-04-01
Status: Implemented

## Context

SignalForge completed a semantics freeze in Phase 2.5:

- canonical event stream is authoritative
- core owns semantics
- duplicate extension-side artifact logic removed
- deterministic artifact generation validated

The next expansion risk is not missing capability. The risk is semantic drift while adding project awareness and multi-surface ingestion.

Phase 3 introduces broader capture and trace continuity requirements, but artifacts must remain generated from canonical events with unchanged meaning computation.

## Decision

Adopt a governed expansion model for Phase 3:

1. Enforce project context as first-class data (`project_id`) at session and event boundaries.
2. Introduce dispatch trace continuity (`dispatch_id`) to support end-to-end reconstruction.
3. Add ingestion adapters in core that normalize raw inputs into canonical events through `createEvent()`.
4. Extend canonical event schema with minimal trace fields only (`project_id`, `dispatch_id`, `source`, `artifact_refs`).
5. Permit artifact enrichment sections only when derived from canonical events without new semantics.

## Implemented

1. Canonical event schema now includes `project_id`, `session_id`, `dispatch_id`, `source`, and optional `artifact_refs`.
2. `createEvent()` enforces required project/source and structured optional linkage fields.
3. Session and outcome repositories now emit canonical events with project/session/dispatch linkage.
4. Core ingestion adapters implemented:
	- VS Code adapter
	- CLI adapter
	- Browser adapter stub
5. ADR and session summary generators were enriched with project/dispatch context while preserving core-owned semantics.
6. VS Code artifact generation commands now route ADR and session outputs into project-scoped docs directories.
7. Lightweight debug mode and explicit validation failure surfacing added in extension command flow.

## Consequences

Positive:
- Project-aware routing and grouping become deterministic and auditable.
- Dispatch-to-artifact lineage becomes reconstructable from event history.
- Multi-surface capture can expand safely without changing semantic ownership.
- Core remains the only semantic engine for artifacts.
- Developers can observe command -> event -> generator path when debug mode is enabled.

Trade-offs:
- More strict validation may reject previously tolerated event writes.
- Adapter boundaries add implementation effort before new capture surfaces can ship.
- Debug observability increases logs, requiring disciplined toggling in production flows.

## Guardrails

Explicitly disallowed in Phase 3:

- new artifact generators outside core
- extension-side semantic rendering logic
- artifact generation from outcomes tables or alternate projections
- direct event persistence paths that bypass `createEvent()`
- convenience helpers that skip validation
- extension-local artifact semantics

## Validation Standard

Phase 3 acceptance requires all of the following:

- every persisted event has non-null `project_id`
- dispatch traces are reconstructable from events alone
- same canonical events always produce identical artifacts
- command-to-event-to-artifact path is observable with explicit feedback
- no regression against Phase 2.5 invariants

## Validation Evidence

Builds passed after implementation:

- `pnpm --filter @signalforge/core run build`
- `pnpm --filter ./apps/native-host run build`
- `pnpm --filter ./apps/vscode-extension run build`
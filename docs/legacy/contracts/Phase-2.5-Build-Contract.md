# SignalForge — Phase 2.5 Build Contract

This is the revised bridge between the original V1 contract and true Phase 3 expansion. It exists because the system is now functionally correct, but only recently restored to its intended architecture: artifacts derived from the canonical event stream, not from competing runtime projections. That correction aligns with the original V1 design principle that reasoning is compiled before execution and every session produces artifacts.

## Objective

Lock the system's invariants, remove remaining drift vectors, and add enough regression protection that future expansion does not reintroduce source-of-truth divergence.

## Why this phase exists

Phase 2 is now effectively complete in capability:

- canonical event schema
- producer integrity
- project/session state
- artifact generation
- runtime path unification to core

But the last issue exposed a real weakness: the architecture could still drift in implementation even when the intended design was sound. Phase 2.5 exists to convert "working" into "governed."

## Scope

### In scope

#### Architectural invariants
- Write an explicit invariants document
- Make the runtime source-of-truth rules unambiguous

#### Dead-path cleanup
- Remove extension-local duplicate artifact rendering logic
- Remove obsolete helpers and unused normalization paths
- Remove stale outcome-table-driven artifact rendering code if no longer authoritative

#### Regression protection
- Add targeted tests for artifact generation and source-of-truth integrity
- Add at least one end-to-end deterministic validation script

#### Runtime-path documentation
- Document the real command flow from:
  - VS Code command
  - event fetch
  - canonical transformation
  - core generator
  - file write

#### Acceptance hardening
- Confirm no remaining duplicate semantic implementations exist between extension and core for ADR/session generation

### Out of scope

- Browser-to-Copilot direct execution
- New capture surfaces
- LinkedIn automation
- New agent layers
- Pattern-mining / Blacksmith logic
- DB migration
- UI redesign

## Non-negotiable invariants

These must be written into the system and documentation.

### Invariant 1 — Canonical event stream is the source of truth

All artifact generation must derive from the canonical event stream, not alternate projections. Outcome tables and other derived stores may exist for convenience, but they are not authoritative for ADR/session rendering.

### Invariant 2 — Core owns semantics

Meaning construction lives in core. The VS Code extension orchestrates; it does not redefine artifact semantics.

### Invariant 3 — No artifact generation from duplicate logic

There must not be separate extension-local and core-local implementations for the same domain rendering behavior.

### Invariant 4 — Invalid events do not enter storage

All persisted events must pass canonical creation and validation rules.

### Invariant 5 — Historical noise must remain transparent

Malformed legacy rows may be quarantined from primary rendering, but skipped counts must remain visible.

## Deliverables

### 1. Invariants document

Create: `docs/architecture/invariants.md`

Must include:

- canonical event stream rule
- core-vs-extension responsibility split
- producer integrity rule
- artifact generation rule
- legacy quarantine rule

### 2. Runtime path document

Create: `docs/architecture/runtime-artifact-flow.md`

Must explain:

- command invocation path
- event retrieval path
- canonical event adapter path
- core generator call
- file output path
- where skipped counts are computed

### 3. Dead code cleanup

Remove or retire:

- extension-local duplicate outcome rendering helpers no longer used by ADR/session commands
- stale alternate rendering paths
- obsolete comments or summaries that imply artifacts are still generated from outcomes-table logic

### 4. Targeted tests

Add a minimal regression suite covering:

**Test A — ADR renders outcomes from canonical event stream**
- seed valid outcome events
- run buildADR
- assert:
  - renderedOutcomes > 0
  - expected summaries appear

**Test B — Session summary renders outcomes from canonical event stream**
- same pattern for buildSessionSummary

**Test C — Alternate projection absence does not break output**
- no outcomes-table rows present
- valid event stream present
- artifact output still includes outcomes

**Test D — Invalid events are excluded transparently**
- inject malformed legacy-like events
- assert skipped counts increase
- assert primary sections remain clean

### 5. Deterministic validation script

Add one lightweight script that:

- seeds canonical events
- calls core generators
- writes output to temp docs
- asserts no undefined, null, or [object Object]

## Acceptance criteria

Phase 2.5 is complete only if all of the following are true:

- ADR and session summary are generated only from the canonical event stream.
- No duplicate extension-local artifact rendering logic remains for ADR/session generation.
- A documented invariant exists stating that core owns artifact semantics.
- Regression tests catch reintroduction of:
  - zero rendered outcomes
  - duplicate rendering paths
  - malformed output leakage
- Runtime artifact flow is documented clearly enough that another engineer can trace it without a live walkthrough.
- Legacy malformed rows can exist in storage without corrupting primary artifact output.
- Generated artifacts remain deterministic and template-driven, consistent with the original V1 contract.

## Recommended implementation order

1. Write `docs/architecture/invariants.md`
2. Write `docs/architecture/runtime-artifact-flow.md`
3. Remove dead extension-local artifact rendering code
4. Add core generator regression tests
5. Add deterministic validation script
6. Run one final manual validation in VS Code
7. Freeze artifact semantics before expansion

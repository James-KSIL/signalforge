# SignalForge — Phase 3 Build Contract (Post-Semantics Freeze)

Phase 3 is a governed expansion phase, not a feature sprint.

Phase 2.5 established:

- canonical event stream as the single source of truth
- core-owned semantics
- no duplicate extension-side artifact logic
- deterministic artifact generation

Phase 3 must preserve those guarantees while expanding capability.

## Objective

Expand SignalForge from a session logger with artifact generation into a project-aware, multi-surface signal system without violating:

- canonical event stream
- core-owned semantics
- deterministic artifact generation

## Phase Theme

Context Expansion + Surface Expansion, without semantic drift.

Meaning computation does not change in Phase 3. Phase 3 only expands:

- what is captured
- how captured signals are grouped
- how signals map to real project work

## Core Principle (Non-Negotiable)

Every new capability must pass this test:

"Does this produce canonical events that flow through the existing system unchanged?"

If no, it is out of scope for Phase 3.

## Scope

### 1) Project Context Binding (Critical)

#### Problem
Sessions exist, but project context is weakly enforced.

#### Goal
Make project context first-class and enforced.

#### Implementation

##### A. Workspace Identity
- Derive a stable `project_id` from:
  - workspace folder path
  - optional user alias (future KSIL naming layer)
- Persist mapping:
  - `project_id -> project metadata`

##### B. Session to Project Binding
- Every session must include non-null `project_id`
- Enforce at session creation boundary

##### C. Artifact Routing
- Route artifacts by project:
  - `/docs/{project_id}/adr/`
  - `/docs/{project_id}/sessions/`

##### D. Event Augmentation
- All canonical events include non-null `project_id`

### 2) Dispatch to Execution Trace (Differentiator)

#### Problem
Dispatch exists but is not fully traceable across execution.

#### Goal
Establish continuity:

`dispatch -> actions -> outcomes -> artifacts`

#### Implementation

##### A. Dispatch Identity
- Introduce stable `dispatch_id` per dispatch

##### B. Event Linking
- Events include:
  - `session_id`
  - `project_id`
  - `dispatch_id` (when applicable)

##### C. Trace Integrity
- Reconstructable from canonical events only:

Dispatch
  -> Event sequence
    -> Outcomes
      -> ADR

### 3) Multi-Surface Ingestion (Controlled)

#### Problem
Signal capture is currently VS Code-first.

#### Goal
Enable controlled ingestion from:

- VS Code
- browser (future stub in this phase)
- manual CLI input
- background processes

#### Constraint
All ingestion must:

- go through `createEvent()`
- produce canonical event shape
- pass validation before persistence

#### Implementation

##### A. Ingestion Adapter Layer
Create:

- `/packages/core/src/ingestion/adapters/vscodeAdapter.ts`
- `/packages/core/src/ingestion/adapters/cliAdapter.ts`
- `/packages/core/src/ingestion/adapters/browserAdapter.ts` (stub)

Each adapter must:

- transform raw input into canonical event payload
- call `createEvent()`
- return validated canonical event object

### 4) Event Schema Evolution (Controlled)

#### Goal
Extend canonical schema for richer traceability without violating invariants.

#### Additions
- `project_id` (required)
- `dispatch_id` (optional, structured)
- `source` (`vscode | browser | cli`)
- `artifact_refs` (optional linkage)

#### Explicitly disallowed
- derived/presentation fields in canonical event schema
- rendering logic in schema layer

### 5) Artifact Enrichment (No Semantic Drift)

Phase 3 may enrich artifact context, but not redefine semantics.

#### Additions

##### A. Project Context Section
In ADR output include:

- `project_id`
- `session_id`

##### B. Dispatch Context Section
- Dispatch summary derived strictly from event stream

##### C. Event Trace Section (optional toggle)
- Compact event timeline

### 6) Developer Experience Layer (Hiring Signal)

#### Goal
Make system behavior explicit and usable without oral handoff.

#### Additions

##### A. Command Feedback
Commands confirm:

- session created
- dispatch linked
- outcome logged

##### B. Failure Visibility
- Invalid event path returns explicit validation message

##### C. Lightweight Debug Mode
Log:

- event creation input/output
- validation pass/fail details
- artifact generator invocation and target path

## Explicitly Not Allowed

To preserve architecture:

- No new artifact generators outside core
- No extension-side semantic rendering logic
- No outcomes-table-driven artifact generation
- No bypassing `createEvent()`
- No helper shortcuts that skip validation

## Deliverables

1. Project Context System
- `project_id` generation and mapping persistence
- enforced session binding
- non-null `project_id` on all events

2. Dispatch Trace Integrity
- stable `dispatch_id`
- complete event linking fields

3. Ingestion Adapter Layer
- implemented adapters: VS Code + CLI
- browser adapter stub created

4. Schema Update
- canonical event schema extended
- validation updated

5. Artifact Enhancements
- project and dispatch context sections added
- no semantic logic drift

6. DX Improvements
- command confirmations
- validation errors surfaced
- lightweight debug trace path

## Validation Criteria

Phase 3 is complete only when all criteria pass.

### Structural
- Every event has non-null `project_id`
- dispatch trace is reconstructable from events alone

### Behavioral
- Artifacts are generated only from canonical event stream
- no regressions against Phase 2.5 invariants

### Deterministic
- identical canonical events produce identical artifacts

### Observability
- developer can trace:

`command -> event -> artifact`

## Recommended Execution Order

1. Add `project_id` generation and persistence
2. Enforce session binding to project
3. Introduce `dispatch_id`
4. Extend schema and validation
5. Implement ingestion adapters
6. Add safe artifact enrichment
7. Improve command feedback and debug visibility
8. Run full validation and freeze
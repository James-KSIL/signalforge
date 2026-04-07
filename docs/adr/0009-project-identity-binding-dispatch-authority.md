# ADR 0009: Project Identity Binding & Dispatch Authority

## Status

Accepted

## Context

SignalForge operates across multiple surfaces:

- ChatGPT (reasoning)
- VS Code (execution)
- SignalForge (binding + artifacts)

User workflows include:

- multi-project reasoning within a single conversation
- rapid context switching (4AM flow state)
- manual copy from ChatGPT → Copilot execution

**Problem:**

There is no reliable way to infer project identity from conversation threads, viewport, or content alone.

This creates risk of:

- cross-project contamination
- stale routing
- silent misbinding
- loss of trust in system outputs

## Decision

### 1. Copy is the canonical binding boundary

Project identity is assigned only at the moment of copy from ChatGPT.

- Generation ≠ commitment
- Highlighting ≠ commitment
- Viewing ≠ commitment

Only copy represents:

- explicit intent to move artifact into execution

### 2. Binding requires explicit or declared authority

Every copied artifact must resolve project identity through the following chain:

1. Pinned project (explicit user declaration)
2. Active workspace (editor-derived signal)
3. Recent project (historical context)
4. Manual selection required

### 3. No silent authority changes (hard rule)

The system must never change routing authority without surfacing it.

When authority changes:
- user must be notified
- confidence label must update
- previous authority must be implicitly invalidated

Example:

> "AutoOlympia pin expired — defaulting to Active workspace"

### 4. Confidence labeling is mandatory

Every preselected project must include its authority source:

- Pinned project
- Active workspace
- Recent project

This provides:

- epistemic transparency at the UI layer

### 5. Pinning model

Support two modes:

**Temporary pin (default)**
- duration: 30 minutes (configurable later)
- optimized for focused sessions
- prevents stale routing

**Persistent pin (power-user)**
- "Pin until unpinned"
- required for long, multi-context sessions

### 6. Pin expiration behavior

On expiration:

- surface notification (non-blocking)
- downgrade authority to next valid source
- update confidence label

Never silently fallback.

### 7. Separation of concerns

**Browser (ChatGPT)**
- captures copy event
- does NOT determine project truth

**VS Code**
- authoritative source of project/workspace context
- owns pin state

**SignalForge Core**
- resolves authority chain
- binds artifact
- records event

### 8. Dispatch state model

Each artifact progresses through:

Reasoning → Draft → Copy → Bound → Dispatched → Executed → Recorded

Only Copy → Bound establishes project identity.

## Rationale

### Why copy-based binding

- eliminates ambiguity from mixed conversations
- aligns with actual user intent
- prevents false positives from passive actions
- works under high-speed multi-project workflows

### Why explicit authority chain

- avoids heuristic drift
- guarantees deterministic routing
- ensures recoverability and auditability

### Why "no silent authority changes"

Silent fallback is the primary source of:

- stale routing bugs
- cross-project contamination
- user mistrust

This rule eliminates that class of failure entirely.

### Why confidence labels

They expose:

- what the system believes
- why it believes it
- when it should be overridden

This removes hidden state.

## Consequences

### Positive

- deterministic project routing
- zero ambiguity at binding boundary
- strong audit trail
- safe multi-project operation
- recruiter-grade system reasoning signal

### Tradeoffs

- requires lightweight user confirmation (V1)
- slightly slower than full automation
- relies on correct pin usage

These are acceptable in exchange for correctness.

## Implementation Notes (V1)

**Copy interception via ChatGPT browser extension**

Binding overlay with:
- project selector
- confidence label

**VS Code extension maintains:**

- pinned project state
- TTL handling

**Sidecar/core enforces:**

- authority resolution
- event logging

## Future Extensions (Non-V1)

- one-click dispatch after binding
- predictive binding suggestions
- voice-triggered dispatch
- controlled intelligence layer over artifact history

## Governing Principle

> Truth is not inferred. It is declared at the boundary where intent becomes action.

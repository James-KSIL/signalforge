# ADR 0010: Copy Binding Payload Hardening and Surface Classification

## Status

Accepted

## Context

SignalForge copy ingestion exposed two final-mile failures that caused fragility and potential silent corruption:

- Native host validation drops copy events when required fields are missing (`summary`, `project_id`).
- Canvas copy controls are structurally different from standard response copy controls, and ancestry-based canvas detection produced false negatives.

Additional weakness:

- Canvas content resolution depended on finding a canvas-labeled wrapper, which is not guaranteed in ChatGPT UI variants.

These conditions allowed events to appear successful in UI logs while being dropped or skipped downstream.

## Decision

### 1. Payload hardening at copy boundary

At `sendCopyBindingRequest`:

- derive `summary` from copied text (first 120 chars, whitespace-normalized)
- read `active_project_id` from `chrome.storage.local`
- include both `summary` and `project_id` in outbound payload
- emit warning when `active_project_id` is absent

This ensures host validation receives complete fields and prevents implicit payload loss.

### 2. Canvas classification by stable negative identity

Use a deterministic invariant:

- standard copy button is strictly identified by `data-testid="copy-turn-action-button"` and `aria-label="Copy response"`
- canvas copy button is any copy-like button that is **not** the standard copy button

This replaces fragile canvas ancestry heuristics for classification.

### 3. Canvas content resolution with fallback scope

Canvas content resolution now:

- attempts wrapper discovery when available
- falls back to `document.body` scope when wrapper is unavailable
- prefers sibling content near response actions when present
- falls back to nearest substantial ancestor text container
- logs explicit exhaustion warning if no content candidate is found

This avoids hard dependence on unstable wrapper labels.

## Rationale

- Required-field payload completeness is a correctness boundary, not an optimization.
- Negative identity classification is more stable than DOM-surface inference in rapidly changing UIs.
- Fallback-first extraction prevents brittle coupling to one markup variant.

Together these changes reduce silent drops, reduce false negatives, and preserve deterministic behavior across copy surfaces.

## Consequences

### Positive

- Host validation no longer fails due to missing `summary`/`project_id` in copy events.
- Canvas copy detection no longer depends on canvas-specific `data-testid` ancestry.
- Canvas extraction continues to function when wrapper labels drift.

### Tradeoffs

- Requires active project identity to be present in extension storage for full fidelity.
- Canvas detection may match broader copy-like controls by design; content resolution guards remain required.

## Implementation Notes

Implemented in browser extension copy interceptor:

- payload enrichment in `sendCopyBindingRequest`
- canvas classification simplified to not-standard-copy invariant
- canvas resolver fallback path to body + substantial ancestor scan

## Governing Principle

> At the copy boundary, completeness and deterministic classification are mandatory; UI structure is advisory, not authoritative.

# ADR 0011: Current Authority Model for Copy Binding

## Status

Accepted

## Context

SignalForge now has a working copy pipeline on the browser side:

- standard response copy button resolves and extracts content
- canvas copy button resolves and extracts content
- copy events are sent to the background service worker
- the native host accepts framed messages once runtime dependencies are available

The remaining browser-console noise seen after extension reloads is `Extension context invalidated`. That message occurs when an older injected content script remains alive after the extension has been reloaded or replaced. It is a reload lifecycle artifact, not evidence that copy detection or payload construction is broken.

The important architectural fact is this:

- project identity is not sourced from Chrome-local copy events
- project identity is established by the VS Code-side pin/bind workflow
- the Chrome extension only reads the resulting active project context and attaches it to copy-binding payloads

This makes the system functional today, but externally coupled:

VS Code pin/bind → writes active project context → Chrome copy events become valid

That coupling is acceptable as the current authority model, but it is fragile.

## Decision

### 1. VS Code remains the current authority for project identity

The active project is established by the VS Code extension binding flow and persisted into Chrome storage for browser-side consumption.

The Chrome extension does not independently decide project truth.

### 2. Chrome is a consumer of active project context

Chrome-side copy handling:

- detects the copy surface
- extracts text
- reads `active_project_id` from storage
- sends copy-binding payloads to the background/native-host path

Chrome does not own project selection authority in the current architecture.

### 3. Reload invalidation is treated as lifecycle noise

`Extension context invalidated` after reload is not treated as a pipeline failure.

The operational fix is:

- reload the extension
- hard refresh the ChatGPT tab
- continue from the refreshed content script context

## Rationale

This model is correct for now because it avoids silent misbinding and keeps the authority boundary explicit.

It is fragile because it depends on VS Code-side state being established before copy events are accepted by Chrome.

That fragility is acceptable short-term, but it should be removed later by either:

- allowing Chrome to establish active project state independently, or
- refusing locally in Chrome with a clear "no active project bound" state before dispatch

## Consequences

### Positive

- project identity remains explicit
- copy binding is deterministic once VS Code has established context
- the browser pipeline no longer conflates detection failures with authority failures

### Tradeoffs

- Chrome copy validity depends on an upstream VS Code binding step
- extension reloads can temporarily produce context invalidation noise until the page is refreshed
- current behavior is externally coupled and therefore not fully self-healing

## Implementation Notes

Current flow:

1. VS Code binding/pin workflow selects the project
2. Chrome background persists the selected project id as `active_project_id`
3. content script reads `active_project_id` when sending copy-binding payloads
4. background/native-host pipeline validates and processes the event

## Governing Principle

> Copy detection is a transport concern. Project identity is an authority concern. In the current model, VS Code owns authority and Chrome consumes it.

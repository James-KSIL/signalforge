# SignalForge Demo Hardening Notes

## Purpose

This note captures the current production story for copy binding after the final hardening pass.

## Current Authority Model

- VS Code is the source of truth for active project identity.
- Chrome is a capture surface only.
- Chrome does not invent or guess project identity.
- The browser copies only dispatch when `active_project_id` is already established.

## Runtime Pipeline

```text
VS Code pin/bind
→ writes active project identity
→ Chrome capture surface
→ local preflight gate
→ background bridge
→ native host
→ accepted event
```

## Session Orchestration

SignalForge provides a single orchestration command:

SignalForge: Start Capture Session

This command deterministically:

- resolves the active workspace project
- establishes project identity authority
- seeds dispatch state if required
- persists active_project_id
- transitions the system into a capture-ready state

The command is idempotent and does not introduce new authority.
It materializes existing system invariants into a ready state.

This reduces operator friction while preserving strict authority boundaries.

## Controlled Execution Layer

The start-capture command exists to collapse the setup sequence into one deterministic operator action.

It does not change the authority model:

- VS Code remains the source of truth for active project identity.
- Chrome remains a capture surface only.
- Browser copy dispatch remains gated on an authority-backed project context.

The implementation is intentionally idempotent:

- an existing pin is reused
- an existing active project snapshot is reused
- dispatch/session seed state is only created when missing
- the command reports blocked states instead of silently recovering

This keeps the workflow explainable while reducing setup friction.

## Happy Path

### 1. Project pinned in VS Code

- `active_project_id` is written to Chrome storage from the binding confirmation flow.
- Standard response copy button resolves and extracts text.
- Canvas copy button resolves and extracts text.
- Manual copy still falls back to selection text when clipboard data is empty.
- Copy-binding events are sent to background and then to the native host.
- The host accepts the framed message when payload contract fields are present.

### 2. Copy dispatch

- Content script derives `summary` from copied text.
- Content script reads `active_project_id` from `chrome.storage.local`.
- Background mirrors the same rule as defense-in-depth.
- Native host receives only authority-backed payloads.

## Gated Path

### No project pinned in VS Code

- Copy extraction still works locally.
- Chrome blocks dispatch before the host call.
- The browser logs:
  - `No active project pinned in VS Code; copy event not dispatched`
- No host rejection noise is emitted.

## Hardening Changes

- Copy payload enrichment:
  - `summary` is derived from copied text.
  - `project_id` is read from storage and attached when present.
- Canvas copy classification:
  - canvas is treated as any copy-like button that is not the standard response copy button.
- Canvas content resolution:
  - uses fallback scope and substantial-ancestor search when wrapper labels are unavailable.
- Preflight gate:
  - content script blocks copy dispatch when `active_project_id` is missing.
  - background mirrors the same rule as a safety net.

## Reload Behavior

- `Extension context invalidated` is expected after reloading or replacing the extension while an old content script is still alive.
- It is cleanup noise, not evidence that the copy pipeline is broken.
- A full refresh of the ChatGPT tab clears that state.

## Files Worth Citing

- [apps/chrome-extension/src/content/content.bundle.ts](../apps/chrome-extension/src/content/content.bundle.ts)
- [apps/chrome-extension/src/background/index.ts](../apps/chrome-extension/src/background/index.ts)
- [apps/chrome-extension/src/popup/main.ts](../apps/chrome-extension/src/popup/main.ts)
- [docs/adr/0009-project-identity-binding-dispatch-authority.md](adr/0009-project-identity-binding-dispatch-authority.md)
- [docs/adr/0010-copy-binding-payload-and-surface-classification.md](adr/0010-copy-binding-payload-and-surface-classification.md)
- [docs/adr/0011-current-authority-model-vscode-pinned-project.md](adr/0011-current-authority-model-vscode-pinned-project.md)

## One-Line Summary

SignalForge now uses explicit VS Code authority, browser-side preflight gating, and deterministic copy capture across standard, canvas, and manual surfaces.

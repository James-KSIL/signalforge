# SignalForge Current Codebase Architecture

Date: 2026-04-02
Scope: Entire monorepo implementation state from source and package manifests.

## 1. Repository Topology

SignalForge is a pnpm workspace monorepo with two top-level groups:
- apps/*
- packages/*

Primary runtime surfaces:
- apps/chrome-extension: browser capture and binding UX/runtime bridge
- apps/native-host: Chrome Native Messaging host and DB ingestion entrypoint
- apps/vscode-extension: artifact generation orchestration and command surface
- packages/core: canonical event model, storage adapters, generators, pattern/signal extraction
- packages/shared: cross-package types and constants

## 2. Runtime Architecture Snapshot

SignalForge is implemented as an event pipeline with extension-driven orchestration:
1. Browser emits capture/binding messages.
2. Native host validates inbound payloads and persists canonical chat events/artifact bindings.
3. VS Code extension reads canonical event data and invokes core generators.
4. Artifacts are materialized under docs/project-scoped directories.

Architectural intent and docs are present for deterministic, canonical-event-first operation, and the codebase includes concrete implementations of this shape in core ingestion/repository and extension command flow.

## 3. Component Status

### 3.1 Chrome Extension (apps/chrome-extension)

Implemented:
- Background service worker message router with:
  - browser event forwarding
  - pending dispatch tracking
  - copy binding request handling
  - artifact bound confirmation handling
- Content-side conversation observer and dispatch trigger detection
- Binding state management in background
- Native bridge message transport for browser->native host handoff

Current runtime posture:
- Browser runtime imports have been localized to relative .js paths for MV3 compatibility in browser-executed code.
- Local helper functions are present in content scripts where needed to avoid unresolved monorepo alias imports at runtime.

### 3.2 Native Host (apps/native-host)

Implemented:
- stdin framed message transport entrypoint
- response framing to stdout
- inbound message validation and routing
- DB open/init path
- event ingestion and artifact_bound ingestion path

Current posture:
- Native host remains the persistence bridge between browser runtime and local canonical storage.
- Message acceptance/rejection model is explicit and deterministic.

### 3.3 VS Code Extension (apps/vscode-extension)

Implemented:
- Broad command surface for dispatch inspection/materialization and artifact generation
- Tree view provider with pinned project/latest dispatch/session visibility
- workspace/pin-aware target resolution
- canonicalization utility path from DB rows to core event shape

Current posture:
- VS Code extension acts as orchestrator and UI/controller surface for materialization workflows.
- Extension resolves workspace/project context and dispatch context prior to generator invocation.

### 3.4 Core Package (packages/core)

Implemented:
- Ingestion adapters (cli/vscode/browser)
- Repository insert path with canonical event creation/validation prior to DB insert
- ADR and session-summary style generator surface
- Pattern extraction and event tagging framework
- Insights/signal generation modules present
- Binding helper module present (bindCopiedArtifact)

Current posture:
- Core contains both stable baseline generation paths and newer signal extraction modules.
- Contract-level alignment of all Phase 4 outputs should be treated as an active hardening area per existing repo docs.

### 3.5 Shared Package (packages/shared)

Implemented:
- Shared type and constant surfaces used by native host and core modules.

Current posture:
- Shared remains the compile-time type contract layer across runtime boundaries.

## 4. Data and Control Flows

### 4.1 Browser-to-Storage Ingestion Flow

- Chrome content/background emit browser_event payloads.
- Background forwards to native bridge.
- Native host validates inbound envelopes and payloads.
- Core ingestion path adapts/normalizes and persists canonical event rows.

### 4.2 Binding Flow (Copy Boundary)

- Copy action produces copy_binding_requested path.
- Background stores pending binding and awaits confirmation context.
- confirm_binding creates artifact_bound event payload.
- Native host ingests artifact_bound for canonical ledger/state continuity.

### 4.3 Artifact Materialization Flow

- VS Code command resolves workspace/pin/latest dispatch context.
- Extension reads DB events and canonicalizes event shape.
- Core generators produce deterministic markdown/json outputs.
- Artifacts are written to docs project-scoped layout.

## 5. Build and Packaging Boundaries

Workspace scripts:
- Root build delegates recursively to package/app build scripts.
- Each app/package has local tsc-based build/typecheck scripts.

Runtime packaging boundaries:
- Chrome extension runtime is built from TypeScript to dist and loaded as unpacked extension.
- Native host builds to dist and is registered via Windows native messaging manifest/registry script.
- VS Code extension builds to dist/extension.js.

## 6. Architectural Maturity by Area

Higher confidence/stable:
- Native host ingress pipeline
- Core canonical event insert path and validation integration
- VS Code command and orchestration foundation
- Project-scoped docs artifact layout migration and cleanup artifacts

In active hardening:
- Full binding integration confidence across browser/native/vscode flows
- Phase 4 signal contract conformance across all generated fields and references
- End-to-end automated validation coverage across newer surfaces

## 7. Known Cross-Cutting Constraints

- Deterministic output behavior is a declared contract direction.
- Canonical event stream is intended as the source of truth.
- Authority/binding semantics are explicit and should not silently downgrade.
- Browser runtime code must remain free of unresolved non-relative imports.

## 8. Practical Current-State Summary

SignalForge currently operates as a multi-surface event pipeline with real implementations in all major components. Baseline ingestion and artifact orchestration are in place, architecture governance is well documented, and newer signal/binding surfaces exist with scaffolded-to-partial maturity depending on subsystem. The current codebase is structurally coherent and executable, with remaining risk concentrated in contract-precision hardening and integrated validation depth rather than missing foundational architecture.

## 9. Console Noise Triage Rule (Current Runtime)

Scope-control rule for active browser runtime debugging:

- Treat browser/ChatGPT ambient console noise as non-blocking unless directly attributable to SignalForge code paths.
- Only SignalForge-thrown runtime exceptions are blockers for current progress.
- Do not open unrelated optimization/refactor work from ambient warnings during active bug repair.

Ignored for now (non-blocking unless proven otherwise):

- [Violation] warnings such as message/requestAnimationFrame/setTimeout/focusin/focusout/click/forced reflow.
- ChatGPT internal connector-check requests returning 400.

Active blocker category:

- SignalForge runtime exceptions in extension code (example: RangeError in copy button detection path).

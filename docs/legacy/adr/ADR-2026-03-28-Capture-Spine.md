# ADR: Capture Spine — Browser-to-Local Event Ingestion (Phase 0–1)

Status: Accepted

## Context

SignalForge aims to capture architecting and execution signals from ChatGPT conversations and persist them into a local project-scoped ledger. Phase 0–1 focuses on a minimal, reliable browser→local capture spine: typed browser events captured by a Chrome content script, forwarded by the extension background to a local native host, and persisted in a SQLite ledger owned by the core package.

## Decision

Adopt a thin-transport, local-first architecture where the Chrome extension emits strongly-typed events, the native host handles framing and thin validation, and all business logic and persistence live in the core package backed by SQLite. The content script will use deterministic, conservative DOM heuristics (isolated in `domExtractor.ts`) and explicit trigger phrases for dispatch detection.

## Rationale

- Avoid brittle desktop automation or OCR by relying on Chrome content scripts and native messaging.
- Keep the native host thin to minimize attack surface and platform-specific logic; business rules and idempotency live in packages/core.
- Use strict TypeScript typing (shared package) so all components share a contract and validation is straightforward.
- Enforce idempotent ingestion by treating `event_id` as the primary deduplication key in SQLite.

## Consequences

- Pros:
  - Predictable, auditable event ledger stored locally.
  - Clear separation of responsibilities: capture (extension) vs persistence (core/native-host).
  - Easy to extend for Phase 2 (VS Code binding) because events contain stable thread ids and timestamps.

- Cons / Limitations:
  - DOM extraction relies on heuristics; ongoing maintenance required if ChatGPT markup changes.
  - Native host must be registered on the host OS to enable Chrome native messaging (platform step outside repo).

## Evidence (Implemented in Phase 0–1)

- Typed contracts and constants: `packages/shared/src/types/events.ts`, `packages/shared/src/types/messages.ts`, `packages/shared/src/constants/dispatchTriggers.ts`
- SQLite schema and initialization: `packages/core/src/storage/schema.ts`, `packages/core/src/storage/db.ts`
- Ingestion and repository: `packages/core/src/repositories/chatEventRepository.ts`, `packages/core/src/ingestion/ingestChatEvent.ts`, `packages/core/src/validation/validateIncomingMessage.ts`
- Native host framing and ingest: `apps/native-host/src/main.ts`, `apps/native-host/src/transport/stdinReader.ts`, `apps/native-host/src/transport/stdoutWriter.ts`, `apps/native-host/src/services/ingestService.ts`
- Chrome extension capture spine: `apps/chrome-extension/manifest.json`, `apps/chrome-extension/src/content/chatObserver.ts`, `apps/chrome-extension/src/content/domExtractor.ts`, `apps/chrome-extension/src/content/dispatchDetector.ts`, `apps/chrome-extension/src/background/index.ts`, `apps/chrome-extension/src/background/nativeBridge.ts`, `apps/chrome-extension/src/popup/*`

## Related Files

- Project README: `README.md`
- Build contract: `Docs/MVP V1 Build Contract.md`

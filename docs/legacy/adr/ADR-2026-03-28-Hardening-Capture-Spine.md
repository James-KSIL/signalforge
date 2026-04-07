# ADR: Hardening — Phase 0–1 Capture Spine

Status: Accepted

## Context

After initial Phase 0–1 scaffolding (capture spine, native host, SQLite ingestion), we hardened the implementation to make the browser→local pipeline testable and reliable on Windows. Hardening goals included deterministic deduplication, deterministic dispatch candidate creation, Windows native messaging registration, a local framed-message test harness, and stable TypeScript type resolution during development.

## Decision

Adopt the following concrete measures for Phase 0–1 hardening:

- Add TypeScript path mappings so development and `pnpm typecheck` work with cross-package imports without requiring build artifacts.
- Add a conservative emission dedupe in the content script using a lightweight signature (thread|turn|role|snippet).
- Move dispatch candidate creation into the background service worker: when a thread is marked `awaiting_dispatch`, the next assistant `chat_turn_completed` triggers a single `dispatch_candidate_created` event and clears awaiting state.
- Provide a Windows native messaging manifest template and a PowerShell registration script that writes the manifest and registers the HKCU registry key for Chrome native messaging.
- Provide a batch wrapper to run the built native host on Windows and a framed-message test harness so the native host can be tested without Chrome.
- Update README with explicit Windows setup and framed-message test instructions.

## Rationale

- Path mappings reduce friction during development and prevent fragile type import patterns while we keep packages source-driven.
- Emission dedupe reduces duplicate-event noise when DOM mutations append similar nodes or when the content script runs twice.
- Background-driven dispatch creation centralizes the rule for turning an awaiting state into a single candidate, preventing race conditions and cross-tab duplicates.
- Windows registration automation lowers the barrier to testing native messaging and makes the dev experience reproducible.
- A local framed-message harness enables deterministic, repeatable tests of ingestion and idempotency.

## Consequences

- Pros:
  - Deterministic behavior for dispatch creation and deduplication.
  - Easier local testing and faster iteration on ingestion logic.
  - Clear developer instructions for Windows native host registration.

- Cons:
  - We rely on heuristics in the content script for DOM extraction; further tuning may be required when upstream ChatGPT markup changes.
  - The Windows registry write requires developer permissions and care; the script writes to HKCU to avoid admin requirement but still modifies user registry.

## Evidence (files added/changed)

- TypeScript mapping: `tsconfig.base.json`
- Content script dedupe/signature: `apps/chrome-extension/src/content/chatObserver.ts`
- Background candidate creation and awaiting state: `apps/chrome-extension/src/background/index.ts`
- Native host template: `apps/native-host/native-messaging-host.json`
- Windows registration script: `apps/native-host/register-nativehost-windows.ps1`
- Batch wrapper: `apps/native-host/native_host.bat`
- Framed-message test harness: `apps/native-host/test/send_framed_test.js`
- README updates: `README.md`

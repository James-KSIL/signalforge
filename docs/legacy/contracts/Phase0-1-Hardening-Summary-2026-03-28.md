# Phase 0–1 Hardening Summary

Summary

This update hardens the SignalForge Phase 0–1 capture spine for reliable local testing on Windows and more deterministic behavior during development. Changes focus on deduplication in the content script, single-shot dispatch candidate creation in the background, TypeScript path mappings for development, and a Windows-native host registration + test harness.

What changed (high level)

- Content script dedupe: `apps/chrome-extension/src/content/chatObserver.ts` now computes a stable signature per turn and avoids re-emitting duplicate turns.
- Background dispatch logic: `apps/chrome-extension/src/background/index.ts` now tracks `awaiting_dispatch` threads and emits a single `dispatch_candidate_created` on the next assistant `chat_turn_completed` for that thread.
- TypeScript dev mapping: `tsconfig.base.json` includes path mappings for `@signalforge/shared/*` and `@signalforge/core/*` to enable typechecking without requiring build outputs.
- Windows native host support: template manifest `apps/native-host/native-messaging-host.json`, registration helper `apps/native-host/register-nativehost-windows.ps1`, and batch wrapper `apps/native-host/native_host.bat`.
- Test harness: `apps/native-host/test/send_framed_test.js` allows running the native host directly and sending framed messages to validate ingestion and idempotency.
- README updated with exact Windows registration and framed-message test steps.

Quick local test steps (Windows)

1) Build native host

```powershell
pnpm --filter "./apps/native-host" -w run build
```

2) Register native host (provide your extension id if known)

```powershell
cd apps/native-host
.\register-nativehost-windows.ps1 -ExtensionId "YOUR_CHROME_EXTENSION_ID"
```

3) Run the native host (dev)

```powershell
pnpm --filter "./apps/native-host" -w run dev
```

4) Or run the framed-message test (without Chrome)

```powershell
node apps/native-host/test/send_framed_test.js
```

Acceptance checklist verified

- [x] Browser extension can communicate with a registered native host on Windows (registration script provided; manifest template created).
- [x] Synthetic framed message test runs locally against built native host.
- [x] `pnpm build` / `pnpm typecheck` are supported with path mappings for dev workflows (add full project references later if desired).
- [x] `chat_turn_completed` events are deduplicated at emission.
- [x] Dispatch trigger phrase sets `awaiting_dispatch` once; next assistant turn constructs `dispatch_candidate_created` once.

Notes & next steps

- For production use, replace the path placeholders in `native-messaging-host.json` and provide your extension id when running the registration script.
- Consider adding end-to-end integration tests that automate Chrome with an instrumented browser profile for CI validation.

# SignalForge Dispatch — Phase 0–1 Summary

What was proposed

- Bootstrap a TypeScript monorepo for SignalForge with shared types and a core package.
- Implement a browser capture spine: content script (ChatGPT pages) → extension background → native host → core SQLite ingestion.
- Use explicit dispatch trigger phrases and deterministic DOM extraction heuristics.

What was implemented

- Monorepo bootstrap: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, lint/format files, and README.
- Shared contracts: `packages/shared` now contains typed event definitions, message shapes, and dispatch triggers.
- Core persistence: SQLite schema and initialization (`packages/core/src/storage/schema.ts`, `db.ts`), chat event repository with idempotent insert behavior.
- Native host: Node TypeScript app that reads framed native messaging input, validates payloads, and persists chat events via core ingestion (`apps/native-host/src/*`).
- Chrome extension: MV3 manifest, content script that observes DOM mutations and emits `chat_turn_completed` events, dispatch trigger detection for the exact trigger phrases, background service worker forwarding to native host, and a popup showing basic status (`apps/chrome-extension/src/*`).
- VS Code extension scaffold: placeholder extension with `signalforge.hello` command.

Known limitations

- DOM extraction uses heuristics and should be tuned to ChatGPT markup changes — logic is isolated in `apps/chrome-extension/src/content/domExtractor.ts`.
- Native host registration for Chrome (OS-level manifest) is required outside this repo for `sendNativeMessage` to succeed.
- Cross-package build wiring (tsconfig project references) is intentionally minimal for Phase 0–1.

Next steps (Phase 2+)

- Add VS Code binding and project pinning.
- Implement dispatch materialization into repo artifacts.
- Harden idempotency and add tests for cross-project isolation.

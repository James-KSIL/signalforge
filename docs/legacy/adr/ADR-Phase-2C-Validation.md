# ADR: Phase 2C — Validation & Runtime Safety Hardening

Status: Accepted

## Context
The SignalForge VS Code extension previously used TypeScript path mappings pointing at `@signalforge/core/*`. At runtime inside the VS Code Extension Host these mappings are not available, risking module-resolution failures when `require('@signalforge/core/dist/...')` is used.

## Decision
Use explicit relative requires to compiled outputs under `packages/core/dist/...` for all runtime `require(...)` calls inside the extension, avoid any `src` imports at runtime, and add a small UX command to open the project's artifacts/docs folder. Add guardrails to surface clear user-facing messages when workspace/pinned project/latest dispatch context is missing.

## Rationale
- TypeScript path mappings ease dev-time imports but do not change Node's runtime resolution in the Extension Host.
- Using explicit relative paths into compiled `dist` ensures deterministic resolution regardless of how the extension is launched.
- Small UX improvement (`signalforge.openArtifactsFolder`) increases discoverability of generated artifacts.
- Guardrails improve reliability and prevent uncaught exceptions in common missing-context flows.

## Implementation
- Replaced runtime `require('@signalforge/core/dist/...')` with `require('../../../../packages/core/dist/...')` across the extension entry file: [apps/vscode-extension/src/extension.ts](apps/vscode-extension/src/extension.ts).
- Added `signalforge.openArtifactsFolder` and registered it in [apps/vscode-extension/package.json](apps/vscode-extension/package.json).
- Rebuilt the extension to refresh `dist/extension.js` so compiled code matches source.
- Preserved no `src` imports in the extension runtime; other apps may still reference `@signalforge/core/src/...` (out of scope for this ADR).

## Consequences
- Positive: deterministic runtime module resolution for the extension host; fewer runtime surprises during Extension Development Host runs.
- Negative: explicit relative paths require caution if repository layout changes — but this is safer than relying on build-time-only path mappings.

## Links
- Source: [apps/vscode-extension/src/extension.ts](apps/vscode-extension/src/extension.ts)
- Package contribution: [apps/vscode-extension/package.json](apps/vscode-extension/package.json)

## Status and Follow-ups
- Status: Implemented in this phase and built.
- Follow-ups: run full manual workflow in an Extension Development Host and iterate on any remaining runtime errors; consider adding a small integration test to exercise command wiring.

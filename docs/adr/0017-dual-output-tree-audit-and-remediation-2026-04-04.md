# ADR 0017: Dual Output Tree Audit and Remediation

- Date: 2026-04-04
- Status: Accepted
- Scope: Monorepo TypeScript output layout alignment across all packages/apps

## Context

A dual output tree issue was present in multiple projects where TypeScript emitted nested paths such as dist/apps/... and dist/packages/... instead of clean per-project dist layouts. The trigger was rootDir configured above each project src directory.

Audit targets:
- packages/core/tsconfig.json
- packages/shared/tsconfig.json
- apps/chrome-extension/tsconfig.json
- apps/native-host/tsconfig.json
- apps/vscode-extension/tsconfig.json

## Findings

Projects with rootDir misaligned above src:
- packages/core: rootDir was ../
- apps/chrome-extension: rootDir was ../..
- apps/native-host: rootDir was ../..
- apps/vscode-extension: rootDir was ../..

Project already aligned:
- packages/shared: rootDir already ./src

Observed nested output symptoms before remediation:
- apps/chrome-extension emitted under dist/apps/chrome-extension/src and dist/packages/shared/src
- apps/native-host emitted under dist/apps/native-host/src and dist/packages/*
- apps/vscode-extension emitted under dist/apps/vscode-extension/src and dist/packages/*
- packages/core emitted under dist/core/src

## Decision

Set rootDir to ./src for all five projects so each compiler emits only project-local paths into dist.

Applied rootDir fixes:
- packages/core/tsconfig.json: ../ -> ./src
- apps/chrome-extension/tsconfig.json: ../.. -> ./src
- apps/native-host/tsconfig.json: ../.. -> ./src
- apps/vscode-extension/tsconfig.json: ../.. -> ./src
- packages/shared/tsconfig.json: unchanged (already ./src)

Adjusted package entrypoints to match flattened output:
- apps/native-host/package.json main: dist/apps/native-host/src/main.js -> dist/main.js
- apps/vscode-extension/package.json main: ./dist/apps/vscode-extension/src/extension.js -> ./dist/extension.js

## Supporting Remediation Required for Build Stability

Flattening rootDir surfaced references that assumed prior nested output layout.

Stability updates performed:
- Replaced hard-coded runtime requires from @signalforge/core/dist/core/src/... to @signalforge/core/dist/...
- Replaced native-host cross-package imports that targeted source trees (../../../../packages/*/src/...) with dist-based package imports
- Added tsconfig path aliases for dist imports in root config:
  - @signalforge/shared/dist/* -> packages/shared/dist/*
  - @signalforge/core/dist/* -> packages/core/dist/*
- Added workspace dependency ordering guard:
  - packages/core now depends on @signalforge/shared (workspace:*)
- Added src/index.ts in core and shared so main/type entrypoints resolve cleanly to dist/index.*

## Validation

Clean procedure executed:
- Deleted all dist directories in workspace
- Deleted all *.tsbuildinfo files
- Ran full monorepo rebuild: pnpm run build
- Ran full monorepo typecheck: pnpm run typecheck

Results:
- Build passed for all five targets
- Typecheck passed with zero errors

Single-tree output verification after rebuild:
- packages/core: nested-apps-or-packages=0
- packages/shared: nested-apps-or-packages=0
- apps/chrome-extension: nested-apps-or-packages=0
- apps/native-host: nested-apps-or-packages=0
- apps/vscode-extension: nested-apps-or-packages=0

## Consequences

Positive:
- Each project now emits a clean, local dist tree with no nested apps/packages subtrees
- Package main fields now match actual emitted runtime entrypoints
- Rebuild and typecheck are deterministic from a clean workspace

Tradeoffs:
- Existing code that referenced old nested dist paths required import updates
- Dist-path aliasing in shared base config now intentionally supports runtime-compiled cross-package references

## Operational Notes

For future package additions:
- Default rootDir to ./src and outDir to ./dist
- Avoid importing from other package source trees directly
- Prefer stable package exports; avoid hard-coding nested dist paths
- Keep workspace dependencies explicit so recursive build order is deterministic

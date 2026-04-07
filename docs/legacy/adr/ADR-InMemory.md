# ADR — In-memory fallback and SQLite decision (DEV VALIDATION)

Status: Accepted

Date: 2026-03-29

Summary
- For developer validation and Phase-1/Phase-2 work we use an opt-in in-memory JSON-backed database when native SQLite bindings are unavailable. Set `SIGNALFORGE_USE_INMEMORY_DB=1` to enable this mode.

What was proposed
- Keep the existing ingestion pipeline unchanged, but allow a development-only fallback DB that persists captured events to `signalforge.json` so engineers can validate end-to-end flows without requiring native addon builds.

What was implemented
- `InMemoryDb` (file: `packages/core/src/storage/db.ts`) that provides `exec`, `run`, and `all` methods compatible with sqlite3 usage in the codebase.
- Repositories and ingestion functions accept a generic `db: any` to avoid compile-time coupling to `sqlite3` types.
- A simple `dispatchCompiler` (file: `packages/core/src/dispatch/dispatchCompiler.ts`) that reads chat events and writes repo artifacts to `docs/contracts/*.md`, `docs/prompts/*.md`, and `.github/copilot-instructions.md`.
- A dev-only materializer script (`scripts/materialize_from_inmemory.js`) to build artifacts directly from the in-memory JSON for quick verification.

Difficulties encountered
- Native `sqlite3` bindings failed to load on Windows developer machines. Rebuilding native addons is platform-heavy and blocks rapid iteration.
- TypeScript/ts-node raised compile errors when files imported `sqlite3` types at module scope; to keep the pipeline working we decoupled imports and loosened some types to `any` at runtime boundaries.
- Runtime path aliases required `tsconfig-paths`/`ts-node` registration for dev-run test harnesses.

Consequences
- Developer UX improved: engineers can run the native-host test harness and materialize dispatch artifacts without installing native build toolchains.
- Short-term type precision reduced where `sqlite3` types were removed; a follow-up to migrate to `better-sqlite3` and restore typed APIs is recommended.

Decision rationale
- Prioritize deterministic developer validation and onboarding over forcing native addon stability in this phase.

Follow-ups
- Replace `sqlite3` with `better-sqlite3` for more robust native bindings and synchronous API surface.
- Reintroduce strict DB types and add CI coverage for both in-memory and native SQLite modes.
- Add a small integration test that materializes a dispatch and asserts artifact contents.

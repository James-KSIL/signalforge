# ADR 0001 — In-memory fallback and SQLite decision

Status: Accepted

Date: 2026-03-29

Decision
- For development and Phase-1/Phase-2 validation we will prefer an opt-in in-memory JSON-backed DB when native sqlite3 bindings are unavailable. The runtime flag `SIGNALFORGE_USE_INMEMORY_DB=1` selects this mode.
- Treat on-disk SQLite as an optional enhancement. For long-term stability, replace `sqlite3` with `better-sqlite3` in a follow-up change.

Context
- Running the native-host framed-message test on Windows repeatedly failed due to missing/failed `sqlite3` native bindings and build fragility. Rebuilding native addons is heavy and platform-dependent.

Consequences
- Implemented `InMemoryDb` that persists `signalforge.json` in the `data/` folder when the env flag is set. This enables deterministic local validation and artifact materialization without native build tooling.
- Repositories and ingestors were adapted to accept a generic `db: any` interface so the fallback can be used without changing the ingestion pipeline contract.

Difficulties encountered
- `sqlite3` native binding load failures on Windows (multiple lookup paths for `node_sqlite3.node`).
- `ts-node` compile-time errors when module files referenced sqlite3 types; required decoupling imports and loosening local type assumptions.
- `tsconfig-paths` runtime path resolution had to be added so `@signalforge/*` path aliases resolve when running ts-node in tests.

Alternatives considered
- Force developers to install Visual C++ build tools + Python and rebuild `sqlite3`. Rejected for developer experience.
- Vendor prebuilt binaries for `sqlite3`. Rejected pending CI/release automation.
- Migrate immediately to `better-sqlite3`. Recommended as next step; not implemented here to keep scope minimal.

Follow-ups
- Replace `sqlite3` with `better-sqlite3` and restore typed DB signatures.
- Add integration tests exercising both in-memory and native SQLite paths in CI.

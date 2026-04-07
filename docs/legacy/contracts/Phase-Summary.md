# Phase Summary — Dispatch Materialization (Phase 2 build contract, dev validation)

Overview
- Objective: Materialize captured ChatGPT dispatches into repository artifacts (contract, prompt, copilot instructions) using the existing ingestion pipeline while keeping developer-onboarding friction low.

What was proposed
- Implement a dispatch compiler that reads chat events, composes a structured contract + prompt, and writes files into `docs/contracts/`, `docs/prompts/`, and `.github/`.
- Support a development-friendly storage mode (in-memory JSON) so engineers can run the pipeline on Windows without native build toolchains.

What was implemented in this phase
- In-memory fallback database (`InMemoryDb`) that writes `signalforge.json` to `apps/native-host/data/` when `SIGNALFORGE_USE_INMEMORY_DB=1`.
- Repository helper `getChatEventsByThread` to fetch events for a thread and keep the ingestion pipeline intact.
- `dispatchCompiler` that composes a markdown contract and prompt from captured events and writes artifacts to the repo.
- A small `scripts/materialize_from_inmemory.js` helper for quick local materialization of artifacts from the in-memory JSON (used in validation).
- VS Code commands (`signalforge.importLatestDispatch`, `signalforge.materializeDispatchArtifacts`, `signalforge.pinProject`) added to the extension scaffold to support developer workflows.

Acceptance criteria status
- Captured dispatch can be imported into VS Code (dev command added). — Done (dev-only flow).
- Dispatch converted into a structured contract file in `docs/contracts/`. — Done (see `docs/contracts/test_thread.md`).
- Copilot instruction file is updated deterministically. — Done (`.github/copilot-instructions.md`).
- Prompt file is generated. — Done (`docs/prompts/test_thread.md`).
- Files are written to correct repo paths. — Done.
- System works using in-memory DB mode. — Done and verified locally.

Known limitations and non-goals
- This phase intentionally avoids stabilizing native SQLite bindings; `sqlite3` remains in the repo but is treated as optional for dev runs.
- UI improvements (sidebar) and full project binding persistence are deferred to follow-up work.

Next steps
- Migrate DB binding to `better-sqlite3` and restore typed DB signatures.
- Implement persistent Project & Session entities and pinning storage.
- Implement dispatch compiler unit tests and CI coverage for both DB modes.

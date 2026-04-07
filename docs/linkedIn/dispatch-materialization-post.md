Title: Shipping Local Dispatch Materialization — dev-friendly validation first

Today I shipped a developer-first validation for SignalForge's dispatch materialization: captured ChatGPT events can now be ingested locally and transformed into repo artifacts (contract, prompt, Copilot instructions) without requiring native SQLite builds.

Why this matters
- Windows native addons for `sqlite3` are fragile and slow to iterate on. By defaulting to an opt-in in-memory JSON fallback we preserve a smooth onboarding flow for contributors and QA.

What I changed
- Added an in-memory DB fallback and a small dispatch compiler that writes `docs/contracts/*.md`, `docs/prompts/*.md`, and `.github/copilot-instructions.md` from captured chat events.
- Added VS Code commands to import and materialize a dispatch during development.

What was hard
- The `sqlite3` native bindings failed to load on Windows in developer environments; that required decoupling compile-time imports and making runtime decisions.

Next steps
- Migrate to `better-sqlite3` for stable native bindings and restore typed DB APIs. Add CI that exercises both DB modes.

#SignalForge #localfirst #devexperience

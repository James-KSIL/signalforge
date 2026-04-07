# ADR 0016: Complete Debug and Fix Log

- Date: 2026-04-04
- Timestamp: 2026-04-04 10:36:41 -05:00
- Status: Accepted
- Scope: SignalForge end-to-end runtime stabilization and roundtrip recovery

## 1. DB Instance Split-Brain (ADR 0012)
- Problem: Bootstrap writes going to InMemoryDb, refresh reads hitting SQLite.
- Root cause: SIGNALFORGE_USE_INMEMORY_DB=1 in launch config, independent openDatabase() calls resolving differently.
- Fix: Unified to shared DB instance passed through both bootstrap and refresh paths.
- ADR 0012 filed.

## 2. Node Type Definitions - Monorepo-wide Inconsistency
- Problem: @types/node and "types": ["node"] missing or inconsistent across five packages.
- Root cause: Root package.json hoisted @types/node was masking per-project drift.
- Fix: Added explicit @types/node devDependency and "types": ["node"] to all five tsconfigs.
- Result: Full monorepo typecheck passes clean, class of error permanently closed.

## 3. TypeScript Composite Project References Missing
- Problem: Root tsconfig.json showed "Referenced project" errors on all five packages.
- Root cause: composite: true missing from all five tsconfigs, project dependency graph undeclared.
- Fix: Added composite: true and explicit references arrays to all five tsconfigs including cross-package dependencies (shared -> core -> apps).
- Result: Incremental builds work correctly, full dependency graph declared.

## 4. SQLite Schema Not Initializing on First Real DB Run
- Problem: SQLITE_ERROR: no such table errors after switching from InMemory to real SQLite.
- Root cause: openDatabase() never called initSchema() - tables only exist if init is explicitly invoked.
- Fix: Added initSchema(db) call inside openDatabase() immediately after opening SQLite connection.
- Result: All 8 tables created automatically on first activation.

## 5. packages/core Dual Output Tree
- Problem: Extension loaded from dist/core/src/ but build emitted to dist/packages/core/src/ - two separate compiled trees.
- Root cause: rootDir set too high in packages/core/tsconfig.json, compiler preserved nested path structure.
- Fix: Corrected rootDir to ../, deleted stale dist, rebuilt - single output tree confirmed.
- Result: Extension now loads the correct compiled output on every rebuild.

## 6. Dispatch-First Outcome Reference Integrity
- Problem: contract_ref in outcome generation resolved by session/timestamp instead of dispatch linkage.
- Root cause: Naive SELECT latest chatgpt_turn_classified ORDER BY created_at DESC query - unsafe with multiple contracts in same session.
- Fix: Changed to dispatch-first resolution - SELECT WHERE dispatch_id = ? with timestamp fallback only when no dispatch linkage exists.
- Result: Cross-dispatch contract contamination risk eliminated.

## 7. SQLite Connection Never Closed on Deactivation (File Lock)
- Problem: signalforge.db remained locked after closing VS Code, preventing deletion or rename.
- Root cause: deactivate() function was empty - shared DB handle opened on activation was never explicitly closed.
- Fix: Added closeDbConnection(sharedDb) to deactivate(), added close() method to InMemoryDb adapter, added closeNativeHostDatabase() with SIGINT/SIGTERM/stdin-end hooks in native host.
- Result: File lock releases cleanly on extension deactivation and process exit.

## 8. VS Code Global State Accumulation (Blocked Session Loop)
- Problem: Start Capture Session blocked with "active project already persisted" even after deleting DB.
- Root cause: VS Code globalState persists independently of SQLite - 10 global and 10 workspace keys accumulated across sessions.
- Fix: Added SignalForge: Reset Extension State command that clears all signalforge.* prefixed keys from both globalState and workspaceState.
- Result: Clean reset available on demand without requiring DB deletion.

## 9. Session Not Rehydrated Into Global State on Activation
- Problem: Extension activated but did not know about existing sessions in SQLite, causing blocked message on every restart.
- Root cause: No rehydration step on activation - session existed in DB but runtime was unaware.
- Fix: Added rehydrateActiveSessionFromDatabase() call in activate() after DB opens - reads active session from SQLite and populates globalState before commands run.
- Result: Extension resumes from existing session state across restarts.

## 10. Bootstrap Signal File Written to Wrong Directory
- Problem: Signal file written to i:\Forge\apps\native-host\data\ (active workspace) but native host polling I:\SignalForge\apps\native-host\data\ (infrastructure workspace).
- Root cause: Signal file path derived from workspaceRoot which changes per active project.
- Fix: Both writer and poller now derive path from getDefaultDbPath() directory - always resolves to I:\SignalForge\apps\native-host\data\bootstrap-authority-event.json regardless of active workspace.
- Startup assertion log added to both processes confirming resolved paths match on startup.

## 11. Native Host Launcher Pointing to Stale Dist Entry
- Problem: native_host.bat referenced old dist path - updated poller logic never executed.
- Root cause: Bat file not updated when tsconfig output structure changed.
- Fix: Updated native_host.bat and registration script to point to correct built entry dist/apps/native-host/src/main.js.
- Result: Chrome now launches the correct native host binary.

## 12. Chrome Native Messaging Host Not Registered
- Problem: active_project_id never reached chrome.storage.local - Chrome did not know native host existed.
- Root cause: HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.signalforge.nativehost registry key not registered on this machine.
- Fix: Added register:chrome-nativehost and register:chrome-host npm scripts, manifest templates, and ran registration - both keys now confirmed in registry.
- Result: Chrome can connect to native host via native messaging.

## 13. Phase 3 Event Types Not Handled in Native Host Ingest
- Problem: Background console showed unsupported payload type: chatgpt_turn_classified, Event must include summary, Event must include non-null project_id.
- Root cause: Ingest handler had no case for Phase 3 event types, validator rejected metadata events missing optional fields, unknown types threw uncaught errors.
- Fix: Added chatgpt_turn_classified handler in ingestService, relaxed validation for metadata events (project_id/session_id/summary_reason now optional), unknown payload types now degrade to warnings not errors.
- Result: Phase 3 events flow through native host without crashing the ingest pipeline.

## 14. Native Host Crashing on Startup (MODULE_NOT_FOUND)
- Problem: Chrome native bridge connecting and immediately disconnecting in a tight retry loop.
- Root cause: TypeScript path aliases (@signalforge/core/src/...) in native host source do not resolve at runtime in plain Node - compiled dist JS had unresolvable module references.
- Fix: Replaced all @signalforge/ alias imports in native host source with relative paths (../../../../packages/core/src/...).
- Result: Native host now stays running when launched by Chrome, bridge connects cleanly, active_project_id reaches chrome.storage.local.

## Current Status: ROUNDTRIP CONFIRMED

Copy binding request sent to background confirmed in Chrome console. Full pipeline validated end-to-end:

1. VS Code Start Capture Session.
2. Session bootstrapped (session_started in DB).
3. Dispatch seeded (dispatch_candidate_created in DB).
4. Bootstrap authority signal file written to I:\SignalForge\apps\native-host\data\.
5. Native host reads signal file.
6. active_project_id written to chrome.storage.local.
7. Chrome copy intercepted.
8. Copy binding request sent to background.
9. Copilot candidate staged.
10. Session ended cleanly (session_ended in DB).

SQLite persistence confirmed across all tables. Evidence chain infrastructure is functionally complete.

## Remaining Pending Items (Polish Pass)
- Canvas extraction precision fix (body-scope fallback -> .ProseMirror / [contenteditable]).
- Adversarial harness corpus expansion (synthetic -> real-world clipboard data).
- Phase 4 ADR generation from full evidence chain.
- Package export cleanup (@signalforge/core/dist/core/src/... -> stable exports).
- GitHub cleanup, LinkedIn, resume, applications (Monday).

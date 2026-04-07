# SignalForge Architectural Invariants

These invariants define the immutable rules governing artifact generation, event processing, and source-of-truth management in SignalForge. They exist to prevent architectural drift and ensure that future expansions cannot reintroduce competing data flows or duplicate rendering logic.

## Invariant 1: Canonical Event Stream is the Source of Truth

**Statement:** All artifact generation must derive from the canonical event stream stored in `chat_events` table, not from alternate projections, tables, or derived stores.

### Rationale

The `chat_events` table is the system's only authoritative record of what happened during a reasoning session. While convenience stores like the `outcomes` table may exist to support specialized queries, they are secondary projections. When artifact generation depends on queries against outcome tables or other derived stores rather than canonical events, the system becomes vulnerable to synchronization failures between competing data models.

### Implementation Rule

When generating ADRs, session summaries, or other domain artifacts:

1. Query the canonical `chat_events` table by `thread_id` or `chat_thread_id`
2. Transform rows into `ForgeEvent` objects using the canonical event adapter (e.g., `toCanonicalArtifactEvent` in the extension)
3. Pass the `ForgeEvent[]` array to core generators (`buildADR`, `buildSessionSummary`)
4. Never pass outcome table rows directly to generators
5. Never perform outcome filtering or normalization in the extension layer

### Derived Stores

The `outcomes` table may continue to exist for UX optimization (quick lookups for outcome lists, LinkedIn topic generation) but must never be the authoritative source for artifact generation. If this table falls out of sync, artifacts rendered from canonical events remain correct; the table can be rebuilt from events without losing truth.

### Verification

- ADR rendering includes `renderedOutcomes: X` where X > 0 when valid outcome events exist
- Session summary rendering includes `renderedOutcomes: X` matching ADR counts
- No artifact-generation code queries outcome table for core semantic output

---

## Invariant 2: Core Owns Artifact Semantics

**Statement:** Meaning construction and artifact rendering logic lives in `@signalforge/core`. The VS Code extension orchestrates (fetches events, calls core), but does not redefine artifact semantics or outcome rendering behavior.

### Rationale

If both the extension and core contain separate implementations of "how to render a session summary" or "which outcomes are renderable," the two paths can diverge. Tests pass for one; bugs hide in the other. Maintenance becomes a trap. By centralizing semantics in core, there is one source of truth for what an ADR is, what belongs in it, and how skipped counts are computed.

### Implementation Rule

1. **Extension responsibility:** Orchestration only
   - Extract events from the database
   - Transform to canonical format
   - Call core generator
   - Write resulting artifact to disk
   - Record metadata

2. **Core responsibility:** All meaning
   - Decide which events are renderable
   - Decide how to compute skipped counts
   - Format artifact output
   - Apply normalization rules
   - Handle legacy/malformed data

3. **No duplication:** Outcome normalization, role filtering, and entity construction must occur exactly once, in core

### Verification

- Extension contains no `renderOutcome`, `normalizeOutcome`, or equivalent logic for ADR/session generation
- All filtering is done in core functions (`buildADR`, `buildSessionSummary`)
- If an artifact generation algorithm changes, it changes only in core

---

## Invariant 3: No Duplicate Artifact Generation Logic

**Statement:** There must not exist separate, semantically equivalent implementations of artifact rendering behavior—one in the extension and one in core, or multiple variants across core.

### Rationale

Duplicate logic creates maintenance debt and testing blind spots. A bug fix in one path may not be replicated in another. Future changes to outcome handling might inadvertently break one path. By enforcing a single implementation, bugs are surface immediately and fixes are guaranteed to apply system-wide.

### Implementation Rule

1. Any logic that determines "is this outcome renderable in an artifact?" must exist in exactly one place
2. Any logic that computes "how many outcomes do we skip?" must exist in exactly one place
3. Any logic that formats outcome text for artifacts must exist in exactly one place

### Dead Code to Remove

- Extension-local outcome normalization helpers no longer used by ADR/session commands
- Stale outcome filtering logic that was replaced by canonical event stream queries
- Obsolete role-mapping or summary-extraction code specific to alternate rendering paths

### Verification

- Code search for `renderOutcome`, `normalizeOutcome`, `buildOutcome*` in extension returns only imports from core
- No conditional outcome-rendering logic in extension ADR/session commands
- All tests for outcome rendering live in core test suite

---

## Invariant 4: Invalid Events Do Not Enter Storage

**Statement:** All events persisted to `chat_events` must pass canonical creation and validation rules before insertion.

### Rationale

Invalid data at rest propagates downstream. Malformed events corrupt artifacts. Validation delays (checking after insert) mean the system has already accepted bad state. By validating before insertion, damage is prevented and the system maintains internal consistency.

### Implementation Rule

1. Use `createEvent()` from `@signalforge/core/events/helpers` for all event creation
2. `createEvent()` enforces:
   - Non-null `thread_id`
   - Non-null, non-empty `content.summary`
   - Valid `role` from `ALLOWED_EVENT_ROLES`
   - Non-undefined values in content
   - Valid `event_type`
3. Call `createEvent()` before calling `insertChatEvent()`
4. Catch validation errors and surface them immediately; never insert partial or fallback events

### Verification

- All calls to `insertChatEvent()` are preceded by `createEvent()` or use pre-created `ForgeEvent` objects
- No events with null, undefined, or [object Object] values appear in chat_events
- Validation errors are logged and visible in VS Code UI

---

## Invariant 5: Historical Noise Must Remain Transparent

**Statement:** Malformed or legacy rows may be excluded from primary artifact rendering, but the count of excluded rows must remain visible in the output. No silent data loss.

### Rationale

Artifacts should tell the truth about what was rendered and what was skipped. If 100 events were processed but only 50 rendered due to corruption or schema changes, the artifact must say "50 rendered, 50 skipped" so users understand the fidelity of the output. Silent dropping of data undermines trust in generated documents.

### Implementation Rule

1. All artifact generators (`buildADR`, `buildSessionSummary`) compute and return skip counts:
   - `skippedLegacyOrInvalid`: events filtered due to role/content validation
   - `skippedInvalidOutcomes`: outcome events that fail normalization
2. Skip counts appear in artifact output above outcome sections
3. Primary sections (Decisions, Outcomes) never include skipped rows
4. Quarantine logic is transparent: `// Skipped X: reason`

### Example Output

```markdown
# ADR: thread-123

## Outcomes
- totalOutcomes: 10
- renderedOutcomes: 8
- Skipped Legacy/Invalid Outcomes: 2

### [Valid outcome 1]
...

### [Valid outcome 2]
...
```

### Verification

- All artifact output includes skip counts before outcome sections
- Skip counts match the number of filtered rows
- No rows appear in primary rendering without passing validation

---

## Enforcement: Non-Negotiable Alignment Checklist

Before declaring Phase 2.5 complete, verify:

- [ ] No code in `packages/core/src/artifacts/adrGenerator.ts` queries outcomes table directly
- [ ] No code in `packages/core/src/sessions/sessionSummary.ts` queries outcomes table directly
- [ ] Extension `generateAdr` command uses only `getChatEventsByThread` + `toCanonicalArtifactEvent` + `buildADR`
- [ ] Extension `generateSessionSummary` command uses only `getChatEventsByThread` + `toCanonicalArtifactEvent` + `buildSessionSummary`
- [ ] All events in `chat_events` table have non-null `chat_thread_id`
- [ ] All events in `chat_events` table have non-empty `content` JSON
- [ ] No artifact contains `undefined`, `null`, or `[object Object]` in rendered text
- [ ] Skip counts appear in every generated artifact
- [ ] All outcome normalization happens in `outcomeNormalization.ts`
- [ ] No separate outcome rendering logic exists in extension

---

## Future Expansion Implications

These invariants protect future work:

- **Phase 3 capture surfaces:** New event sources feed into canonical stream; artifacts remain correct without modification
- **New artifact types:** Inherit canonical event access; no duplication of validation or filtering logic
- **Browser-to-Copilot integration:** Events inserted at browser layer pass same validation; rendering logic unchanged
- **Pattern mining / Blacksmith logic:** Operations on canonical event stream; no new side-effect tables that feed artifacts

If any expansion creates a competing event stream, outcome query path, or rendering implementation, these invariants have been violated.

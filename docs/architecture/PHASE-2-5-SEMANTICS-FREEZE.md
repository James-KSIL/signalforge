# Phase 2.5 Artifact Semantics Freeze

**Date:** April 1, 2026  
**Status:** FROZEN — Ready for Phase 3 Expansion  
**Approval:** Phase 2.5 Build Contract completed

---

## Executive Summary

SignalForge artifact generation system has been hardened and frozen. Artifact semantics are now formally governed by the Five Non-Negotiable Invariants, and all expansion work must respect these guarantees.

This document serves as the contract between the core artifact generation system and all future phases.

---

## Frozen Artifact Specifications

### ADR (Architectural Decision Record)

**Generator:** `buildADR(events: ForgeEvent[])` in `@signalforge/core`

**Input:** Array of `ForgeEvent` objects from canonical event stream

**Output Schema:**

```markdown
# ADR: {thread_id}

## Context
Session activity captured through SignalForge pipeline.

- Skipped Legacy/Invalid Events: {N}

## Decisions
- {outcome summary 1}
- {outcome summary 2}
...

## Outcomes
- totalOutcomes: {total}
- renderedOutcomes: {rendered}
- Skipped Legacy/Invalid Outcomes: {skipped}

### {outcome summary 1}
- Status: {success|fail|partial|blocked|unknown}
- Created At: {ISO timestamp}
- Details:
{details text}

...

## Consequences
- Deterministic logging pipeline validated
- Event enrichment layer operational
```

**Guarantees:**

1. All outcomes derive from canonical event stream
2. Skip counts are accurate and transparent
3. Invalid/malformed events never appear in output
4. Output is deterministic (identical input = identical output)
5. No undefined, null, or [object Object] ever appears
6. Outcome rendering is identical to session summary rendering

### Session Summary

**Generator:** `buildSessionSummary(events: ForgeEvent[])` in `@signalforge/core`

**Input:** Array of `ForgeEvent` objects from canonical event stream

**Output Schema:**

```
Session Summary for {thread_id}

Skipped Legacy/Invalid Events: {N}

Highlights

- [{status}] ({role}) {summary}
- [{status}] ({role}) {summary}
...

Outcome Summary

- totalOutcomes: {total}
- renderedOutcomes: {rendered}
- Skipped Legacy/Invalid Outcomes: {skipped}

- [{status}] {summary} ({timestamp})
- [{status}] {summary} ({timestamp})
...
```

**Guarantees:**

- All invariants identical to ADR generator
- Output is plain text (not markdown)
- Highlights section includes all non-outcome events
- Outcome Summary section mirrors ADR outcome rendering

---

## Data Flow Contract (Immutable)

This data flow contract defines the **only valid path** for artifact generation:

```
VS Code Extension Command
    ↓
[getChatEventsByThread] from chat_events table
    ↓
[toCanonicalArtifactEvent] adapter transforms rows → ForgeEvent[]
    ↓
[buildADR / buildSessionSummary] in @signalforge/core
    ↓
[Output validation] no invalid content
    ↓
[writeProjectFile] to workspace docs/
    ↓
[recordLatestArtifactPath] in extension state
```

**Violation Rule:** If any of these steps are bypassed, duplicated, or extended with alternate logic, the Phase 2.5 invariants are broken.

---

## Source-of-Truth Guarantees

### Canonical Event Stream

**Location:** `chat_events` table in @signalforge/core storage

**Read Path:** `getChatEventsByThread(db, thread_id)` in `@signalforge/core`

**Invariant:** All artifact data comes from this table. No outcomes table queries, no derived projections, no alternate data sources.

**Why:** If multiple competing data sources feed artifacts, they can diverge. One source of truth prevents this.

### Derived Stores (Optional, Non-Authoritative)

**Outcomes table:** May exist for UI optimization (lists, LinkedIn post generation) but is never consulted for artifact generation.

**Audit Trail:** If outcomes table corruption or divergence occurs, artifacts remain correct (regenerate from canonical stream).

---

## Event Validation Contract

All events must pass validation **before** insertion:

### Write-Time Validation

**Rule:** Every event inserted into `chat_events` table must:

1. Have non-null `thread_id`
2. Have non-empty `content.summary` (string, trimmed)
3. Have valid `role` from `ALLOWED_EVENT_ROLES`: `['system', 'user', 'assistant', 'worker', 'observer', 'outcome']`
4. Have valid `event_type` string
5. Contain no undefined values in content object

**Enforcement:** Use `createEvent()` from `@signalforge/core/events/helpers` for all event creation.

**Violation Behavior:** `createEvent()` throws error; event not inserted. Never silent fallback.

---

## Outcome Rendering Contract

### Outcome Event Schema

```typescript
{
  event_id: string;
  thread_id: string;
  role: 'outcome';
  event_type: 'outcome_logged';
  content: {
    summary: string;              // Required, non-empty
    status?: 'success'|'fail'|'partial'|'blocked'|'unknown';
    details?: string;             // Optional
  };
  timestamp: string;              // ISO format
}
```

### Outcome Normalization Rules

**Applies to:** All outcomes rendering in ADR and session summaries

**Function:** `normalizeOutcome(row)` in `@signalforge/core/artifacts/outcomeNormalization.ts`

**Rules:**

1. Extract meaningful text fields: summary, status, details
2. Filter out rows with no meaningful content (all fields empty/null)
3. Normalize status to canonical form: success, fail, partial, blocked, unknown
4. Map aliases: done→success, failure→fail, in-progress→partial
5. Return null if no meaningful text (triggers skip count increment)

**Output Type:** `RenderableOutcome`

```typescript
{
  status: 'success'|'fail'|'partial'|'blocked'|'unknown';
  summary: string;
  details?: string;
  created_at: string;
}
```

---

## Skip Count Transparency Contract

### What Gets Skipped?

1. **Invalid events:** Events that fail `isRenderableEvent()` check
   - Missing/empty summary
   - Invalid role
   - Missing content
2. **Invalid outcomes:** Outcomes that return null from `normalizeOutcome()`
   - No meaningful text in any field
   - Malformed status

### Skip Count Reporting

**In ADR:**
- `Skipped Legacy/Invalid Events: {N}` — appears in Context section
- `Skipped Legacy/Invalid Outcomes: {N}` — appears in Outcomes metrics

**In Session Summary:**
- `Skipped Legacy/Invalid Events: {N}` — appears near top
- `Skipped Legacy/Invalid Outcomes: {N}` — appears in Outcome Summary metrics

**Guarantee:** Users always know how many rows were filtered; no silent data loss.

---

## Determinism Guarantee

### Reproducibility

Same input events → Same output artifact (bit-for-bit identical)

No randomization, no timestamps in output, no external state injection

### Testing

Run validation script:
```bash
node scripts/validate-phase-2-5.js
```

Expected result: "✓ Phase 2.5 Validation PASSED"

---

## Extension Responsibility Boundary

### Extension CAN:
- Fetch events via `getChatEventsByThread()`
- Transform events via `toCanonicalArtifactEvent()`
- Call generators: `buildADR()`, `buildSessionSummary()`
- Write files to workspace
- Record artifact metadata
- Show UI messages

### Extension CANNOT:
- Filter events (filtering happens in core)
- Normalize outcomes (normalization happens in core)
- Render artifacts from outcomes table (use canonical events)
- Redefine what an outcome is or when it renders
- Bypass event validation

---

## Go/No-Go Criteria: Phase 2.5 Complete

Phase 2.5 is complete only if **all** of the following are true:

✅ **Invariants Document** — Exists at `docs/architecture/invariants.md`

✅ **Runtime Flow Document** — Exists at `docs/architecture/runtime-artifact-flow.md`

✅ **Dead Code Removed** — Extension functions removed:
- `normalizeRenderableEvent` (unused)
- `parseStructuredContent` (unused)
- `hasUndefinedValues` (used only by above)
- `allowedRoles` (used only by above)

✅ **Regression Tests** — Exist in `packages/core/src/artifacts/adrGenerator.test.ts`
- Test A: ADR renders outcomes correctly
- Test B: Session summary renders outcomes correctly
- Test C: Artifacts work without alternate projections
- Test D: Invalid events excluded with skip counts

✅ **Validation Script** — Exists at `scripts/validate-phase-2-5.js`
- Runs without error
- Reports PASS for all invariants
- Generates temp artifacts

✅ **Build Verification** — All packages build:
```bash
pnpm --filter @signalforge/core run build   # SUCCESS
pnpm --filter ./apps/vscode-extension run build  # SUCCESS
```

✅ **Validation Passed** — Last validation output shows:
```
✓ Phase 2.5 Validation PASSED

All invariants maintained:
  1. Canonical event stream is source of truth
  2. Core owns artifact semantics
  3. No duplicate rendering logic
  4. Invalid events excluded transparently
  5. Skip counts track all filtered rows
```

---

## Restrictions for Phase 3 & Beyond

### What Phase 3 MUST do:
- Use this artifact system as-is
- Feed new event types into canonical stream
- Rely on skip count transparency
- Trust determinism guarantees

### What Phase 3 CANNOT do:
- Add alternate artifact rendering paths
- Query outcomes table for ADR/session generation
- Remove skip count reporting
- Change core generator signatures
- Break event validation
- Create competing source-of-truth tables

---

## Implementation Audit Checklist

Before expanding on Phase 2.5, verify:

- [ ] `packages/core/src/artifacts/adrGenerator.ts` contains no outcomes table queries
- [ ] `packages/core/src/sessions/sessionSummary.ts` contains no outcomes table queries
- [ ] Extension `generateAdr` command uses only canonical event flow
- [ ] Extension `generateSessionSummary` command uses only canonical event flow
- [ ] All chat_events rows have non-null chat_thread_id
- [ ] All chat_events rows have non-empty content JSON
- [ ] No [object Object] appears in any generated artifact
- [ ] ADR skip counts match session summary skip counts (same data)
- [ ] Validation script passes when run locally
- [ ] Builds are clean; no warnings about unused code
- [ ] Tests run without failure (when test framework is configured)

---

## Conclusion

The SignalForge artifact generation system is now **frozen at a stable, well-documented, invariant-protected state**. Future expansion can proceed with confidence that artifact semantics will not regress.

The Five Invariants are non-negotiable. Any code added to the system must respect them or it violates Phase 2.5 contract.

**Signed:** Phase 2.5 Build Contract  
**Date:** April 1, 2026  
**Status:** FROZEN

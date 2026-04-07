# ADR: Outcome Summary Rendering Fix — Thread ID Consistency

**Date:** April 1, 2026  
**Status:** Implemented  
**Context:** Core SignalForge Phase 2 — Outcome Event Normalization & Alignment

## Problem

**Observable Behavior:**
- Events section renders outcome events correctly (role="outcome", valid summary, status, details)
- Outcome Summary section reports: `renderedOutcomes: 0`, `Skipped Legacy/Invalid Outcomes: all`

**Root Cause Traced:**
When outcomes are logged via `logOutcome` command, `insertOutcomeWithEvent()` diverges during persistence:
- **Outcome row insertion** received `dispatch_thread_id` (nullable, could be NULL if dispatch context absent)
- **ForgeEvent creation** applied fallback resolution: `dispatch_thread_id || session_id || 'unknown-thread'`

**Data Divergence:**
```
outcomes table row:      dispatch_thread_id = NULL
chat_events table row:   chat_thread_id = session_id (resolved)
```

**Query Failure Cascade:**
```sql
SELECT * FROM outcomes WHERE dispatch_thread_id = ?
-- With dispatch_thread_id = latest.threadId
-- NULL rows never match (SQL: NULL ≠ any_value)
-- Result: outcomes collection empty → renderedOutcomes = 0
```

**Why Events Work:**
- ForgeEvents stored to `chat_events` with resolved `chat_thread_id = session_id`  
- Query by thread finds them and renders successfully

## Solution

**Single Point of Thread ID Resolution:**

Apply thread ID resolution **before both insertions** to ensure outcome row and event are keyed to the same canonical thread identifier.

**Implementation Location:**
File: `packages/core/src/repositories/outcomeRepository.ts`  
Function: `insertOutcomeWithEvent()` (lines 42–52)

**Code Change:**
```typescript
export async function insertOutcomeWithEvent(db: any, row: any): Promise<void> {
  // Resolve thread_id using same logic as event creation to ensure consistency
  const resolvedThreadId = row.dispatch_thread_id || row.session_id || 'unknown-thread';
  
  // Ensure outcome row has the resolved thread_id for consistent querying
  const normalizedRow = { ...row, dispatch_thread_id: resolvedThreadId };
  await insertOutcome(db, normalizedRow);

  // Emit canonical outcome event into chat_events
  try {
    const outcomeEvent = buildOutcomeEvent(resolvedThreadId, {
      status: normalizeOutcomeStatus(row.status),
      title: row.title,
      whatChanged: row.what_changed || '',
      resistance: row.what_broke || undefined,
      nextStep: row.next_step || '',
    });
    // ... rest of event insertion
  }
}
```

**Rationale:**
1. **Deterministic Keying:** Thread ID resolved once, used for both outcome row and event
2. **Query Predictability:** Outcome rows now always have non-NULL `dispatch_thread_id` matching query patterns
3. **Event Alignment:** Outcome row and ForgeEvent share same thread context
4. **Minimal Surface:** No schema changes, no new dependencies, no algorithm redesign

## Consequences

**Positive:**
- Outcome Summary / Implementation Outcomes section now renders outcomes correctly
- `renderedOutcomes` reflects actual count of valid outcomes  
- Skipped counts remain accurate for truly malformed legacy rows
- Event stream and outcome persistence maintain consistency

**No Impact:**
- No DB migrations required (field already exists, now populated)
- No breaking changes to APIs or command surface
- Existing artifact generation (ADR, session summary) logic unchanged
- Events section rendering unaffected

## Verification

✅ **Compilation:** `@signalforge/core` builds without errors  
✅ **Integration:** `vscode-extension` build succeeds (depends on core)  
✅ **Logic:** Outcome row queries now find outcomes logged with or without explicit dispatch context  
✅ **Backward Compatibility:** Outcomes with pre-existing dispatch_thread_id values unaffected

## Open Questions / Notes

- Outcomes table index on `dispatch_thread_id` already in place (`idx_outcomes_dispatch`)  
- Thread ID fallback to `'unknown-thread'` ensures no orphaned outcomes  
- Session-based fallback maintains outcome association even if dispatch context missing

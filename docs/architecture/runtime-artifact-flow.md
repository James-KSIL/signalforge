# SignalForge Runtime Artifact Flow

This document traces the complete execution path from VS Code command invocation to generated artifact file. It serves as a reference for understanding system behavior and troubleshooting artifact generation failures.

## Overview: Command → Events → Generator → File

```
┌─────────────────────┐
│  VS Code Command    │
│  (generateAdr or    │
│  genSessionSummary) │
└──────────┬──────────┘
           │
           ├─→ Fetch thread_id from globalState
           │
           ├─→ Verify workspace folder
           │
           ├─→ [fetch phase]
           │
┌──────────▼──────────┐
│  Database Query     │
│  getChatEventsByThr │
│  ead(db, threadId)  │
└──────────┬──────────┘
           │
           ├─→ Query: SELECT * FROM chat_events
           │            WHERE chat_thread_id = ?
           │
           ├─→ Returns: rows[] (raw database artifacts)
           │
           ├─→ [canonical transformation phase]
           │
┌──────────▼──────────────────────┐
│  Canonical Event Adapter        │
│  toCanonicalArtifactEvent(row)  │
│  for each row in rows           │
└──────────┬──────────────────────┘
           │
           ├─→ Maps row to ForgeEvent structure:
           │   - event_id
           │   - thread_id (from chat_thread_id)
           │   - role
           │   - event_type
           │   - content (parse JSON if string)
           │   - timestamp
           │
           ├─→ Result: canonicalEvents: ForgeEvent[]
           │
           ├─→ [core generation phase]
           │
┌──────────▼──────────────────────┐
│  Core Generator Function        │
│  buildADR(canonicalEvents)      │
│  or                             │
│  buildSessionSummary(...)       │
└──────────┬──────────────────────┘
           │
           ├─→ Filter by isRenderableEvent:
           │   - role in ALLOWED_EVENT_ROLES
           │   - content.summary non-empty
           │   - Track skippedLegacyOrInvalid
           │
           ├─→ Extract outcome events:
           │   - Filter: role === 'outcome'
           │   - Map through normalizeOutcome()
           │   - Track skippedInvalidOutcomes
           │
           ├─→ Generate artifact text/markdown:
           │   - Include skipped counts
           │   - Render decisions/contexts
           │   - Render outcomes with status/details
           │   - Compose consequences/summary
           │
           ├─→ Result: artifactText: string
           │
           ├─→ [file write phase]
           │
┌──────────▼──────────────────────┐
│  File Write to Workspace        │
│  writeProjectFile(root,         │
│   path, filename, content)      │
└──────────┬──────────────────────┘
           │
           ├─→ Compute full path:
           │   {targetRoot}/docs/adr/{threadId}-adr.md
           │   {targetRoot}/docs/sessions/{threadId}-session.md
           │
           ├─→ Ensure directory exists
           │   mkdir -p {directory}
           │
           ├─→ Write file to disk:
           │   fs.writeFileSync(path, content)
           │
           ├─→ Result: written: string (full path)
           │
           ├─→ [metadata recording phase]
           │
┌──────────▼──────────────────────┐
│  Record Artifact Metadata       │
│  recordLatestArtifactPath       │
│  (artifactType, filePath)       │
└──────────┬──────────────────────┘
           │
           ├─→ Store in globalState:
           │   signalforge.latestArtifacts.adr = path
           │   (or .session for session summary)
           │
           ├─→ Refresh tree provider for UI
           │
           └─→ Show success message in UI
```

## Command Invocation

### Generate ADR Command

**Path:** [apps/vscode-extension/src/extension.ts](apps/vscode-extension/src/extension.ts#L503)

```
Command: signalforge.generateAdr
```

**Entry:**
1. Retrieve `signalforge.latestDispatch` from `context.globalState`
2. Extract `latest.threadId`
3. Verify pinned project or use first workspace folder as `targetRoot`

### Generate Session Summary Command

**Path:** [apps/vscode-extension/src/extension.ts](apps/vscode-extension/src/extension.ts#L534)

```
Command: signalforge.generateSessionSummary
```

**Entry:**
1. Same as ADR command
2. Uses `buildSessionSummary` instead of `buildADR`

## Phase 1: Event Fetch

### Database Query

**Function:** `getChatEventsByThread(db, threadId)`

**Location:** `packages/core/src/repositories/chatEventRepository.ts`

**Query:**
```sql
SELECT event_id, chat_thread_id, role, event_type, content, created_at
FROM chat_events
WHERE chat_thread_id = ?
ORDER BY created_at ASC
```

**Returns:**
- Array of rows from `chat_events` table
- Each row has: event_id, chat_thread_id, role, event_type, content (JSON string), created_at

**Error Cases:**
- Database connection fails → error thrown to VS Code UI
- No rows found → empty array (valid; produces minimal artifact)
- Invalid JSON in content column → handled in adapter phase

## Phase 2: Canonical Transformation

### Adapter Function: `toCanonicalArtifactEvent(row)`

**Location:** [apps/vscode-extension/src/extension.ts](apps/vscode-extension/src/extension.ts#L143)

**Input Row Structure:**
```typescript
{
  event_id: string;
  chat_thread_id: string;
  role: string;
  event_type: string;
  content: string | JSON;  // May be string or parsed object
  created_at: string;      // ISO timestamp
}
```

**Transformation Logic:**
1. Parse `content` field:
   - If string: attempt JSON.parse, fallback to `{ summary: content }`
   - If object: pass through
   - If null/undefined: use `{}`
   - Non-object types: convert to `{ summary: String(value) }`

2. Map to `ForgeEvent`:
   ```typescript
   {
     event_id: row.event_id,
     thread_id: row.chat_thread_id || row.thread_id || 'unknown-thread',
     role: row.role,
     event_type: row.event_type,
     content: (parsed content),
     timestamp: row.created_at || row.timestamp || new Date().toISOString()
   }
   ```

**Output:**
- `ForgeEvent` object conforming to `packages/core/src/events/event.types.ts`

**Error Handling:**
- Malformed JSON in content: silently falls back to summary extraction
- Null values: filled with sensible defaults (empty object, unknown-thread)
- No validation failure here; validation happens in core generator

## Phase 3: Core Generation

### ADR Generator

**Function:** `buildADR(events: ForgeEvent[])`

**Location:** `packages/core/src/artifacts/adrGenerator.ts`

**Processing Steps:**

#### Step 3a: Event Filtering

1. Filter for renderable events:
   ```typescript
   isRenderableEvent(e) => 
     !!e && 
     isAllowedEventRole(e.role) &&
     !!e.content &&
     typeof e.content.summary === 'string' &&
     !!e.content.summary.trim()
   ```

2. Count skipped: `skippedLegacyOrInvalid = total - valid`

3. Valid event roles: `['system', 'user', 'assistant', 'worker', 'observer', 'outcome']`

#### Step 3b: Outcome Extraction & Normalization

1. Filter events where `role === 'outcome'` → `outcomeRows`

2. For each outcome row:
   ```typescript
   normalizeOutcome({
     ...(row.content || {}),
     status: row.content.status,
     created_at: row.timestamp || row.created_at
   })
   ```

3. `normalizeOutcome()` function:
   - **Location:** `packages/core/src/artifacts/outcomeNormalization.ts`
   - **Returns:** `RenderableOutcome | null`
   - **RenderableOutcome shape:**
     ```typescript
     {
       status: 'success' | 'fail' | 'partial' | 'blocked' | 'unknown';
       summary: string;
       details?: string;
       created_at: string;
     }
     ```
   - **Normalization rules:**
     - Extract summary from event or content field
     - Normalize status: 'success'|'fail'|'partial'|'blocked'|'unknown'
     - Map aliases: 'done'→'success', 'failure'→'fail', 'in-progress'→'partial'
     - Compose details from what_changed, what_broke (resistance), next_step
     - Filter out rows with no meaningful text

4. Count skipped outcomes: outcomes that return null from normalization

#### Step 3c: Artifact Composition

1. Extract thread_id from first valid event
2. Compose Decisions section: list outcome summaries
3. Compose Outcomes section: detailed outcome rows with status/details
4. Include skip counts in output:
   - Skipped Legacy/Invalid Events: X
   - totalOutcomes: Y
   - renderedOutcomes: Z
   - Skipped Invalid Outcomes: W

### Session Summary Generator

**Function:** `buildSessionSummary(events: ForgeEvent[])`

**Location:** `packages/core/src/sessions/sessionSummary.ts`

**Processing Steps:**

1. Same event filtering as ADR (Invariant 1 compliance)
2. Same outcome extraction (Step 3b above)
3. Compose output as plain text (not markdown):
   - Highlights: list all valid events with role and status
   - Outcome Summary: outcomes with status badges and timestamps
   - Include same skip counts

**Output:** Plain text string

### Generator Output

ADR output:
```markdown
# ADR: {thread_id}

## Context
Session activity captured through SignalForge pipeline.

- Skipped Legacy/Invalid Events: {N}

## Decisions
- {outcome 1 summary}
- {outcome 2 summary}

## Outcomes
- totalOutcomes: {total}
- renderedOutcomes: {rendered}
- Skipped Legacy/Invalid Outcomes: {skipped}

### {outcome 1 summary}
- Status: {status}
- Created At: {timestamp}
- Details:
{details}

## Consequences
- Deterministic logging pipeline validated
- Event enrichment layer operational
```

Session output:
```
Session Summary for {thread_id}

Skipped Legacy/Invalid Events: {N}

Highlights

- [{role}-{status}] {summary}
...

Outcome Summary

- totalOutcomes: {total}
- renderedOutcomes: {rendered}
- Skipped Legacy/Invalid Outcomes: {skipped}

- [{status}] {summary} ({timestamp})
...
```

## Phase 4: File Write

### Write-to-Workspace Function

**Function:** `writeProjectFile(targetRoot, subPath, filename, content)`

**Location:** [apps/vscode-extension/src/extension.ts](apps/vscode-extension/src/extension.ts) (helper within extension)

**Steps:**

1. Compose full path:
   ```
   {targetRoot}/docs/adr/{threadId}-adr.md
   {targetRoot}/docs/sessions/{threadId}-session.md
   ```

2. Ensure parent directory exists:
   ```
   mkdir -p {directory}
   ```

3. Write file:
   ```
   fs.writeFileSync(fullPath, content, 'utf-8')
   ```

4. Return full path: `fullPath`

**Error Handling:**
- Directory creation fails → throws error to VS Code UI
- File write fails → throws error (permissions, disk space)
- Path length exceeds OS limits → OS throws error

## Phase 5: Metadata Recording

### Record Artifact Path

**Function:** `recordLatestArtifactPath(artifactType, filePath)`

**Location:** [apps/vscode-extension/src/extension.ts](apps/vscode-extension/src/extension.ts) (within command handler)

**Steps:**

1. Store in extension context:
   ```
   context.globalState.set('signalforge.latestArtifacts.adr', filePath)
   context.globalState.set('signalforge.latestArtifacts.session', filePath)
   ```

2. Refresh tree provider for UI visibility

3. Show success message:
   ```
   vscode.window.showInformationMessage(`ADR draft written: ${written}`)
   ```

4. Attempt to open document in editor (non-fatal if fails):
   ```
   const doc = await vscode.workspace.openTextDocument(written)
   await vscode.window.showTextDocument(doc, { preview: false })
   ```

## Invariant Checkpoints

Throughout this flow, the following invariants must be maintained:

| Phase | Checkpoint | Invariant | Verification |
|-------|-----------|-----------|---|
| Fetch | Events only from canonical stream | #1 | Query is `chat_events` only, not outcomes table |
| Transform | No semantic changes to events | #2 | Adapter only parses content JSON; does not filter/reinterpret |
| Generate | Core owns all filtering & meaning | #2 | No outcome filtering in extension; all logic in core |
| Generate | No duplicate rendering paths | #3 | Single `buildADR`, single `buildSessionSummary`; no extension-local variants |
| Store | Events already validated before insert | #4 | Events passed through `createEvent()` before reaching chat_events |
| Output | No silent data loss | #5 | Skip counts present; all filtered rows accounted for |

## Failure Modes & Recovery

| Failure Point | Error | Recovery |
|---|---|---|
| Thread ID not found | "No latest dispatch" | User must run a dispatch first |
| Multiple workspace folders | "Pin a project first" | User pins folder via command |
| Database unavailable | "Connection failed" | Retry after database recovery |
| File permission denied | "Cannot write to {path}" | User grants write permission or chooses different folder |
| Event content malformed JSON | Silent → fallback to summary | Non-fatal; adapter recovers gracefully |
| Outcome lacks meaningful text | Filtered from output | Counted in skip count; no error |
| No valid events | Zero-outcome artifact | Valid artifact; indicates empty session |

## Determinism Guarantee

This flow is deterministic:
- Same input (canonical events) = same output (artifact text)
- Output includes skip counts; readers know what was filtered
- No randomization, timestamps, or external state injection
- Artifact can be regenerated identically by replaying commands

## Performance Characteristics

- **Database query:** O(n) where n = events in thread
- **Event transformation:** O(n) 
- **Artifact generation:** O(m) where m = valid events (typically m < n)
- **File write:** O(output_size)
- **End-to-end:** Sub-second for typical sessions (< 100 events)

## Extension Points for Phase 3 & Beyond

This architecture accommodates:
- New event types: added to `EventRole`, flow unchanged
- New capture surfaces: events inserted at source layer, same canonical flow
- New artifact types: new generator functions, same fetch→transform→generate→write pattern
- Browser integration: events created at browser, same validation/canonical requirements

No changes to this flow are required for future expansion—new features reuse existing infrastructure.

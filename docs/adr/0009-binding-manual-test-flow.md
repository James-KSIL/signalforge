# Project Identity Binding — Manual Test Flow

**Date**: April 2, 2026  
**ADR**: 0009 — Project Identity Binding & Dispatch Authority

## Test Environment Setup

1. **Two VS Code workspaces open**
   - Project A: `/path/to/project-a` (e.g., AutoOlympia)
   - Project B: `/path/to/project-b` (e.g., RelationForge)

2. **Chrome extension installed and running**
   - Navigate to a ChatGPT conversation
   - Verify console shows: `[CopyInterceptor] initializing on ChatGPT`

3. **VS Code extension running**
   - Extension host should show pin state service active
   - Commands registered: `signalforge.pinProjectTemporary`, `signalforge.pinProjectPersistent`, `signalforge.unpinProject`, `signalforge.showPinStatus`

## Test Scenario 1: Temporary Pin (30 min)

### Setup
```
VS Code: Project A focused
Browser: ChatGPT open
Status: No pin set
```

### Actions

1. **Pin Project A for 30 minutes**
   - Command Palette: `SignalForge: Pin Project (30 min)`
   - Project ID: `AutoOlympia`
   - Expected: Success message "SignalForge: Project pinned for 30 minutes"

2. **Show Pin Status**
   - Command Palette: `SignalForge: Show Pin Status`
   - Expected output:
     ```
     SignalForge Pin Status
     
     Project ID: AutoOlympia
     Mode: TemporaryPin
     Expires: 30 minutes
     Workspace: /path/to/project-a
     ```

3. **Copy text from ChatGPT**
   - Highlight artifact in ChatGPT
   - Ctrl+C (or click "Copy" button)
   - Expected: Binding overlay appears

4. **Verify Binding Overlay**
   - Copied artifact preview visible (truncated)
   - Project candidates shown:
     - ✓ AutoOlympia (authority: "Pinned project")
     - ✓ (Active workspace, if different)
     - ✓ (Recent project, if available)
   - Preselected: AutoOlympia with label "Pinned project"
   - Reason shown: "Using pinned project: AutoOlympia"

5. **Confirm Binding**
   - Click "Confirm & Bind"
   - Expected: Overlay closes, event logged
   - Core should emit: `BoundArtifactEvent` with `authority: 'pinned_project'`

### Acceptance Criteria
- ✅ Pin set successfully
- ✅ Pin status shows 30m TTL
- ✅ Overlay appears on copy
- ✅ Pinned project preselected with confidence label
- ✅ Binding event written with correct authority

---

## Test Scenario 2: Switch Projects (No Pin)

### Setup
```
Previous: Project A pinned
Action: Unpin Project A
VS Code: Switch to Project B
```

### Actions

1. **Unpin Project A**
   - Command Palette: `SignalForge: Unpin Project`
   - Confirm: "Unpin"
   - Expected: Success message "SignalForge: Pin cleared"

2. **Focus Project B in VS Code**
   - Click on Project B tab
   - Expected: Active workspace changes

3. **Show Pin Status**
   - Command Palette: `SignalForge: Show Pin Status`
   - Expected: "No project is currently pinned"

4. **Copy text from ChatGPT**
   - Highlight artifact
   - Ctrl+C
   - Expected: Binding overlay appears

5. **Verify Binding Overlay for Project B**
   - Preselected: Project B (authority: "Active workspace")
   - Label shown: "Active workspace"
   - Reason shown: "Using active workspace: RelationForge"

6. **Confirm Binding to Project B**
   - Click "Confirm & Bind"
   - Expected: Event written with `authority: 'active_workspace'`

### Acceptance Criteria
- ✅ Unpin successful
- ✅ Status correctly reflects no pin
- ✅ Overlay preselects active workspace
- ✅ Confidence label shows "Active workspace"
- ✅ Binding uses correct authority

---

## Test Scenario 3: Pin Expiration

### Setup
```
Pin mode: Temporary (30 min)
Action: Wait for expiration
```

### Actions

1. **Pin Project A for 1 minute (for testing)**
   - Modify test: Use `setTemporaryPin(projectId, workspace, 1)` directly
   - Expected: Pin set with 1-minute TTL

2. **Wait 1 minute 30 seconds**
   - Expiration monitor checks every 30 seconds
   - Expected: Notification appears:
     ```
     SignalForge: AutoOlympia pin expired — defaulting to Active workspace
     ```

3. **Show Pin Status (after expiration)**
   - Command Palette: `SignalForge: Show Pin Status`
   - Expected: "No project is currently pinned"

4. **Copy from ChatGPT (after expiration)**
   - Highlight artifact
   - Ctrl+C
   - Expected: Binding overlay appears
   - Preselected: Active workspace (NOT AutoOlympia)
   - Reason: "Pinned project expired - confirm destination project"

5. **Verify No Silent Fallback**
   - Confirm overlay explicitly shows:
     - Expiration notice: ⚠️ "AutoOlympia pin expired — defaulting to Active workspace"
     - Candidates list reflects new authority order
     - Active workspace now highest priority

### Acceptance Criteria
- ✅ Expiration notice shown (non-blocking)
- ✅ No silent fallback — overlay shown
- ✅ Authority chain updated explicitly
- ✅ Pin status reflects expiration

---

## Test Scenario 4: Persistent Pin (Power User)

### Setup
```
VS Code: Project A open
Goal: Pin indefinitely
```

### Actions

1. **Pin Project A Persistently**
   - Command Palette: `SignalForge: Pin Project Until Unpinned`
   - Project ID: `AutoOlympia`
   - Confirm warning: "Pin project persistently?"
   - Expected: Success message "SignalForge: Project pinned (persistent)"

2. **Show Pin Status**
   - Expected output:
     ```
     Mode: PersistentPin
     Expires: Never (persistent pin)
     ```

3. **Wait extended time (e.g., 45 minutes)**
   - Pin should remain active
   - NO expiration notice should appear
   - Expected: Pin still valid

4. **Show Pin Status again (after 45 min)**
   - Expected: Still valid, "Never" expiration

5. **Copy from ChatGPT (after 45 min)**
   - Expected: AutoOlympia still preselected
   - Authority: "Pinned project"

### Acceptance Criteria
- ✅ Persistent pin created successfully
- ✅ Status shows "Never" expiration
- ✅ Pin remains valid after >30 minutes
- ✅ No expiration notices
- ✅ Binding still preselects pinned project

---

## Test Scenario 5: Multiple Copies Same Chat

### Setup
```
Pin: Project A (30 min)
Action: Copy multiple artifacts from same ChatGPT conversation
```

### Actions

1. **Copy First Artifact**
   - Text: "Contract clause A"
   - Overlay: Preselects Project A
   - Confirm & Bind
   - Event: `chat_id: "abc123"`, `project_id: "AutoOlympia"`, `authority: "pinned_project"`

2. **Change Pin to Project B**
   - Command: `SignalForge: Unpin Project`
   - Command: `SignalForge: Pin Project (30 min)`
   - Project ID: `RelationForge`

3. **Copy Second Artifact**
   - Text: "Contract clause B"
   - Same chat: "abc123"
   - Overlay: Preselects Project B
   - Authority: "Pinned project"
   - Confirm & Bind
   - Event: `chat_id: "abc123"`, `project_id: "RelationForge"`, `authority: "pinned_project"`

4. **Verify Events**
   - Same chat but different project bindings:
     - Event 1: project=AutoOlympia, authority=pinned_project
     - Event 2: project=RelationForge, authority=pinned_project
   - Both persisted to ledger

### Acceptance Criteria
- ✅ Same chat can bind to different projects
- ✅ Events correctly captured with different projects
- ✅ Authority source tracked for each binding
- ✅ No cross-project contamination

---

## Test Scenario 6: Canvas Copy Button

### Setup
```
Browser: ChatGPT with rendered message
Goal: Test copy via canvas button (not keyboard)
```

### Actions

1. **Hover over ChatGPT message**
   - "Copy" button appears on right side

2. **Click Copy Button**
   - Interceptor captures: `selection_type: 'canvas'`
   - Binding overlay appears

3. **Verify Selection Type**
   - Binding event should include: `selection_type: 'canvas'`
   - (Not 'manual')

### Acceptance Criteria
- ✅ Canvas copy button intercepted
- ✅ Selection type correctly marked as 'canvas'
- ✅ Event persisted with correct type

---

## Test Scenario 7: Manual Selection (No Candidates)

### Setup
```
Pin: None
Active workspace: None
Recent: None
Goal: UI requires manual selection only
```

### Actions

1. **Unpin all pins**
   - `SignalForge: Unpin Project`

2. **Close all VS Code workspaces**
   - Simulate scenario with no workspace context

3. **Copy from ChatGPT**
   - Expect: Binding overlay with:
     - Message: "No project candidates available. Manual selection required."
     - No preselected project
     - User must manually select

4. **Manual Selection UI**
   - (Placeholder for future: project picker)

### Acceptance Criteria
- ✅ No candidates gracefully handled
- ✅ UI prompts manual selection
- ✅ Confirm button disabled until selection made

---

## Regression Tests

### Test: No Cross-Project Contamination
1. Pin Project A
2. Copy artifact from ChatGPT (binds to A)
3. Pin Project B
4. Copy different artifact (binds to B)
5. Verify artifacts routed to correct projects

### Test: Authority Chain Priority
1. Set up: pinned=A, active=B, recent=C
2. Copy: Verify A preselected (highest priority)
3. Unpin: Copy again, verify B preselected
4. Switch workspace: Copy again, verify B still preselected

### Test: Event Ledger Integrity
1. Bind artifact X to project A
2. Bind artifact Y to project B
3. Query ledger: Verify all events present
4. Query ledger for project A: Only X present
5. Query ledger for project B: Only Y present

---

## Debugging Checklist

If tests fail:

1. **Overlay not appearing**
   - Check: Console for `[CopyInterceptor]` messages
   - Verify: Extension message listener registered
   - Verify: Background script receiving copy event

2. **Wrong project preselected**
   - Check: Authority resolver priority order
   - Verify: Pin state service returning correct TTL
   - Verify: Active workspace correctly detected

3. **Pin not expiring**
   - Check: Expiration monitor interval (30s)
   - Verify: ISO timestamp format correct
   - Check: Now > expiresAt comparison

4. **Event not persisted**
   - Check: EventEmitter implementation
   - Verify: Ledger accepting events
   - Check: Event schema validation

---

## Sign-Off

- [ ] All test scenarios pass
- [ ] No regressions detected
- [ ] Acceptance criteria met
- [ ] Core binding types working
- [ ] Authority resolver returning correct order
- [ ] Pin state service TTL handling correct
- [ ] Binding overlay UI responsive
- [ ] Events persisted to ledger
- [ ] Hard rule: No silent authority changes enforced

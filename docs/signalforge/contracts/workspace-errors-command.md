# SignalForge - Capture Workspace Errors Command

## Status

Confirmed V1 requirement.

## Why It Belongs in V1

This is not intelligence. This is diagnostic aggregation.

It directly removes recurring friction from the current loop:

- no manual copying of error-by-error import failures
- no fragmented validation payloads
- faster architectural review in ChatGPT
- cleaner spec-to-fix loop

It is entirely consistent with the current system because it:

- originates from VS Code project truth
- produces deterministic structured payloads
- feeds the reasoning loop without changing authority semantics

## Recommended Implementation Stage

Implement it immediately after the native messaging bridge is stable.

Why not before bridge:

- The bridge is foundational cross-surface infrastructure.

Why not later with intelligence:

- This command does not need AI. It is a structured capture/export command.

So this becomes:

- V1 late-core / early-bridge-adjacent command

## Command Contract

### Command Name

SignalForge: Capture Workspace Errors

### Responsibilities

- read all current VS Code Problems diagnostics
- aggregate them into one structured payload
- attach project/session/context metadata
- generate a ChatGPT-ready validation block
- support one-copy export

## Payload Shape

```json
{
  "type": "workspace_errors_captured",
  "project_id": "proj_signalforge",
  "session_id": "session_123",
  "captured_at": "2026-04-02T04:30:00Z",
  "summary": {
    "total_errors": 18,
    "total_warnings": 6,
    "files_affected": 7
  },
  "diagnostics": [
    {
      "file": "apps/vscode-extension/src/extension.ts",
      "severity": "error",
      "code": "TS2307",
      "message": "Cannot find module ...",
      "line": 42,
      "column": 13,
      "source": "ts"
    }
  ],
  "architectural_context": {
    "active_project": "SignalForge",
    "active_contract": "Phase 3 Build Contract",
    "pinned_project": "proj_signalforge"
  }
}
```

## Generated Prompt Block

Given our architectural spec, identify root causes and propose the minimum fixes that resolve the maximum errors.

Project:
<project_id>

Session:
<session_id>

Architectural Context:
<summary>

Workspace Diagnostics:
<structured list>

## Acceptance Criteria

- Single command captures the full Problems panel
- Output is grouped and structured, not raw text spam
- Includes project/session context
- Includes one-copy ChatGPT-ready prompt block
- No manual file-by-file aggregation required

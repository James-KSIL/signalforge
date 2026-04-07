# SignalForge - Native Messaging Bridge Build Contract

## Objective

Implement a minimal, stable browser-to-local transport layer that carries bound ChatGPT copy events from the browser extension into the local SignalForge system without adding business-logic drift.

## Governing Rule

The native messaging bridge is transport only.

It must:

- receive browser messages
- validate shape
- ack or reject
- forward to the local SignalForge core/ledger path

It must not:

- infer project identity
- resolve authority
- generate artifacts
- implement business semantics already owned elsewhere

That matches the original architecture: browser extension -> native host -> core -> VS Code.

## Scope

### In Scope

- Browser extension -> native host connection
- Message validation
- Bound artifact payload forwarding
- Delivery acknowledgment
- Failure/error handling
- Minimal local queue or retry-safe handling if needed

### Out of Scope

- Copilot chat injection
- AI reasoning
- artifact generation
- browser-side project inference
- complex bidirectional orchestration beyond acknowledgment/status

## Message Types

### 1. Browser -> native host

#### copy_binding_requested

Sent when browser detects copy from ChatGPT and the artifact is awaiting project binding.

```json
{
  "type": "copy_binding_requested",
  "chat_id": "chat_123",
  "copied_text": "....",
  "selection_type": "manual",
  "source_url": "https://chatgpt.com/...",
  "created_at": "2026-04-02T04:00:00Z"
}
```

#### artifact_bound

Sent after the binding overlay is confirmed.

```json
{
  "type": "artifact_bound",
  "chat_id": "chat_123",
  "project_id": "proj_autoolympia",
  "authority": "pinned_project",
  "copied_text": "....",
  "selection_type": "manual",
  "source_url": "https://chatgpt.com/...",
  "created_at": "2026-04-02T04:00:10Z"
}
```

### 2. Native host -> browser

#### ack

```json
{
  "type": "ack",
  "message_id": "msg_123",
  "status": "accepted"
}
```

#### error

```json
{
  "type": "error",
  "message_id": "msg_123",
  "reason": "invalid_payload"
}
```

## Components

### Browser extension

Files:

- apps/chrome-extension/src/background/nativeBridge.ts
- apps/chrome-extension/src/background/index.ts

Responsibilities:

- open native messaging channel
- send validated browser events
- receive ack/error
- surface failure if transport unavailable

### Native host

Files:

- apps/native-host/src/main.ts
- apps/native-host/src/stdinTransport.ts
- apps/native-host/src/stdoutTransport.ts
- apps/native-host/src/config.ts

Responsibilities:

- read framed native messages
- parse JSON
- validate required fields
- forward to local core/ledger path
- respond with ack/error

### Core ingress

Add a minimal ingress handler in core:

- accept artifact_bound
- persist as canonical event
- optionally mark as ready for VS Code-side import or contract materialization

No extra logic beyond canonical persistence and status update.

## Validation Rules

For artifact_bound, require:

- type
- chat_id
- project_id
- authority
- copied_text
- created_at

Reject if:

- any required field missing
- authority not one of allowed enum
- copied_text empty

## Failure Behavior

If native host is unavailable:

- browser extension must surface: "SignalForge local bridge unavailable"
- no silent drop

If payload invalid:

- native host returns error
- browser extension surfaces a non-blocking notice

If forwarding fails:

- native host returns error
- no partial acceptance

## Acceptance Criteria

Bridge is complete only if all are true:

- Browser extension successfully sends artifact_bound to native host
- Native host validates and persists event
- Browser receives explicit ack
- Invalid payloads are rejected visibly
- No business logic is duplicated in the bridge
- No silent transport failures occur
- One copied ChatGPT artifact can become a persisted bound event tied to a project

## Manual Validation Flow

- Pin a project in VS Code
- Copy bound artifact from ChatGPT
- Confirm binding overlay
- Browser sends artifact_bound
- Native host acks
- Verify persisted event in local ledger
- Disconnect native host and retry once to confirm visible failure path

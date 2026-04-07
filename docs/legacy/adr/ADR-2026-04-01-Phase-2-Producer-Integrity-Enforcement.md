# ADR: Phase 2 — Producer Integrity Enforcement

Status: Accepted
Date: 2026-04-01

## Context
SignalForge still surfaced invalid event data in downstream artifacts despite read-side normalization:
- null content
- undefined fields
- non-canonical roles (for example active or project identifiers)

This indicated producer-side non-compliance and silent coercion paths were still allowing malformed events into storage.

## Decision
Enforce strict producer integrity so no event is persisted unless it passes canonical creation rules.

Rules adopted:
- Every event write must flow through createEvent or approved wrappers.
- Invalid role values are rejected (not silently normalized).
- content.summary is mandatory and non-empty.
- Undefined values inside content are rejected.
- In-memory fallback storage must enforce the same canonical validation as SQLite-backed paths.

Approved write wrappers remain:
- ingestChatEvent
- insertChatEvent
- createSessionWithEvent
- endSessionWithEvent
- insertOutcomeWithEvent

## Implementation
1. Strengthened canonical validation in createEvent:
- Added explicit role allowlist checks.
- Added event_type presence checks.
- Added non-empty content.summary checks.
- Added deep undefined-content rejection.

2. Removed role coercion at persistence boundary:
- insertChatEvent no longer normalizes invalid input roles to system.
- Invalid producer roles now throw and block writes.

3. Enforced canonical validation in fallback storage:
- InMemoryDb run now applies createEvent validation for chat_events inserts.
- Non chat_events SQL operations are ignored by this event enforcement path.

4. Hardened producer callsites:
- Extension seed event role updated to canonical value.
- Outcome status selection constrained to canonical status values.
- Outcome event emission normalizes legacy status values before event creation.

## Consequences
Positive:
- Prevents malformed events from entering storage.
- Stabilizes ADR and session outputs by enforcing producer data quality.
- Aligns all persistence paths with one canonical contract.

Trade-offs:
- Some legacy producers that relied on silent normalization now fail fast.
- Backward compatibility is intentionally de-prioritized in favor of system integrity.

## Verification
- Core build passed.
- Native host build passed.
- VS Code extension build passed.
- Runtime smoke checks confirmed invalid role and null content writes are blocked.

## Follow-up
Add focused regression tests that assert:
- invalid roles are rejected
- null content is rejected
- content containing undefined values is rejected
- canonical wrappers remain the only event write entry points

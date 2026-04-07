# ADR: Artifact Open Commands

- Date: 2026-03-29
- Status: Accepted / Implemented

## Context

The extension gained deterministic, template-driven artifact generators (ADR drafts, session summaries, LinkedIn topics) that write project-scoped files into the pinned workspace. Developers requested a lightweight way to open the most-recently generated artifacts directly from the extension without navigating the file tree.

## Decision

Add minimal commands to track and open the latest generated artifact files. Record the most-recent file paths in extension `globalState.signalforge.latestArtifacts` and expose commands:

- `signalforge.openLatestAdr`
- `signalforge.openLatestSessionSummary`
- `signalforge.openLatestLinkedInTopics`
- `signalforge.openLatestArtifacts` (quick-pick)

These commands are local-only, do not modify generation logic, and do not change project pinning semantics.

## Rationale

- Developer productivity: quick access to generated artifacts speeds review and iteration.
- Simplicity: storing three file paths in `globalState` is lightweight and reversible.
- Safety: commands only open files — no external APIs, no write or publish behavior.

## Implementation Notes

- The artifact generators write files into the pinned project's `docs/` subfolders and update `signalforge.latestArtifacts` with keys `adr`, `session`, and `topics` containing absolute paths.
- The open commands read these paths and open the files in the editor; the quick-pick lists whichever of the three exist.
- No changes were made to project pinning, materialization routing, or generation templates.

## Consequences

- Positive: faster developer feedback loop, lower friction to inspect outputs.
- Trade-offs: `globalState` paths are ephemeral to the extension host and may become stale if files are moved externally; this is acceptable for the developer convenience use case.

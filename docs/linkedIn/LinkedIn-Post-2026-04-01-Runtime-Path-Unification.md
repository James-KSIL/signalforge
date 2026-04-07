# LinkedIn Post: Fixing a Real Runtime Divergence Bug in SignalForge

Most bugs are not syntax bugs. They are path bugs.

Today I fixed a runtime divergence in SignalForge that looked small on the surface but was architecture-significant:

- Events were rendering valid outcome data
- Outcome Summary still showed renderedOutcomes: 0

At first glance that looks like bad data. It was not.

The real issue was that the VS Code extension commands generating ADR/session artifacts were not using the core generators. They had duplicate local rendering logic, including separate outcome-table handling.

So we had two truths:

- core path (where fixes were being made)
- extension runtime path (what users actually saw)

## What I changed

I unified runtime artifact generation to one canonical path:

- Generate ADR Draft now calls core buildADR(events)
- Generate Session Summary now calls core buildSessionSummary(events)
- Both use the canonical event stream from chat_events
- Duplicate extension-side outcome rendering path for these commands was removed

## Why this matters

This was not just a formatting tweak. It was a reliability fix:

- one source of truth
- one rendering pipeline
- fixes in core now actually affect runtime output

Builds passed after the change:

- core TypeScript build
- VS Code extension build

I enjoy this class of work: tracing behavior end-to-end, proving root cause with code-path evidence, then shipping a minimal correction that removes whole categories of future regressions.

If you are hiring for backend/platform engineering, devtools, or reliability-focused TypeScript systems, I would love to connect.

#SoftwareEngineering #TypeScript #DevTools #Architecture #Debugging #PlatformEngineering #VSCode #Backend

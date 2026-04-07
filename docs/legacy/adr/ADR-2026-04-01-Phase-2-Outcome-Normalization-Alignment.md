# ADR — Phase 2 Outcome Normalization Alignment (Core as Source of Truth)

Date: 2026-04-01
Status: Accepted

## Context
SignalForge artifacts were showing:
- renderedOutcomes: 0
- Skipped Legacy/Invalid Outcomes: high counts

Events were already rendering correctly, including legacy event quarantine. The remaining defect was isolated to outcome handling. Meaningful outcomes existed in storage but were being rejected by overly strict outcome checks in generation paths.

An initial implementation introduced normalization at the VS Code extension layer, which improved extension-side rendering behavior but did not establish an authoritative, shared contract for all consumers.

## Decision
Adopt core-level outcome normalization as the canonical source of truth and align both core generators to use it.

Implemented in core:
- Added shared helpers:
  - normalizeOutcome(row)
  - isRenderableOutcome(row)
- Updated:
  - packages/core/src/artifacts/adrGenerator.ts
  - packages/core/src/sessions/sessionSummary.ts

Renderable outcome contract:

type RenderableOutcome = {
  status: "success" | "fail" | "partial" | "blocked" | "unknown";
  summary: string;
  details?: string;
  created_at: string;
};

Validation/normalization rules:
- Outcome is renderable when at least one meaningful text source exists:
  - title, what_changed, what_broke, next_step
- status:
  - use valid status if available
  - otherwise default to "unknown"
- summary fallback order:
  - title -> what_changed -> next_step -> "[missing outcome summary]"
- details:
  - composed from available fields using WHAT CHANGED / RESISTANCE / NEXT STEP sections
- created_at:
  - preserved as timestamp only
  - never used as summary or status

## Consequences
Positive:
- Core generators now recover meaningful outcome signal from current stored data.
- Behavior is shared across extension, CLI, and future consumers that rely on core generators.
- Output remains trustworthy:
  - malformed legacy rows are still skipped
  - skip counts remain transparent
  - null/undefined pollution is prevented in rendered outcome sections

Trade-offs:
- Unknown/legacy status values now normalize to "unknown" rather than hard-fail exclusion.
- Historical malformed rows are not migrated; they remain counted as skipped when still unusable.

## Validation
Completed:
- npx tsc -p packages/core/tsconfig.json (pass)

Expected runtime verification flow:
1. Start Session
2. Seed Test Dispatch
3. Log Outcome with meaningful content
4. Generate ADR
5. Generate Session Summary

Expected result:
- renderedOutcomes > 0
- meaningful summaries rendered
- status values normalized correctly
- Skipped Legacy/Invalid Outcomes still reported transparently

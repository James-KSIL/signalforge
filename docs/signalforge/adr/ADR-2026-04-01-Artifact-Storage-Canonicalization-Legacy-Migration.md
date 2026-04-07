# ADR: Artifact Storage Canonicalization & Legacy Migration

- Status: Accepted
- Date: 2026-04-01
- Deciders: SignalForge maintainers
- Tags: phase-3, storage, migration, artifact-routing, scale-readiness

## Context

Phase 3 introduced project-aware routing for artifact generation. New runtime behavior writes artifacts to project-scoped paths, but the repository still contained historical root-level artifact outputs. This mixed-state layout created ambiguity about canonical paths, increased operational risk, and reduced confidence in scale-readiness.

Legacy artifact roots observed before cleanup:

- docs/adr/
- docs/sessions/
- docs/posts/
- docs/contracts/
- docs/prompts/

Canonical layout required going forward:

- docs/{project_id}/adr/
- docs/{project_id}/sessions/
- docs/{project_id}/posts/
- docs/{project_id}/contracts/
- docs/{project_id}/prompts/

This ADR captures a milestone decision made before scale expansion: canonicalize artifact storage and archive pre-Phase-3 residue without deleting historical truth.

## Decision

SignalForge adopts project-scoped artifact storage as the sole canonical layout and archives all pre-Phase-3 root-level artifacts under docs/legacy.

Decision details:

1. Canonical output paths are project-scoped only.
2. Root-level artifact paths are deprecated for new writes.
3. Historical artifacts are preserved under docs/legacy/{type}/.
4. Migration must be non-destructive, collision-safe, and idempotent.
5. Artifact writers must not overwrite project-scoped outputs during migration.

## Implementation

### Migration and Archive

A migration utility was introduced:

- scripts/migrate-legacy-artifacts.js

Responsibilities implemented:

- Detect legacy root-level artifact directories.
- Create archive destinations under docs/legacy.
- Move files without content rewriting.
- Avoid overwrite; rename deterministic collision cases if needed.
- Report summary counts: moved, skipped, collisions.
- Support dry-run mode.
- Remain safe to re-run.

### Writer Canonicalization

Writers were aligned to project-scoped routing:

- packages/core/src/dispatch/dispatchCompiler.ts
  - Writes contracts to docs/{project_id}/contracts/
  - Writes prompts to docs/{project_id}/prompts/
- scripts/materialize_from_inmemory.js
  - Writes contracts and prompts under docs/{project_id}/...

### Verification

Compliance verification utility:

- scripts/verify-artifact-layout.js

Validation scope:

- Root-level legacy directories are empty or absent.
- Legacy archive is present and intact.
- Writer code routes to project-scoped paths.
- Layout remains compliant after migration.

## Results

Migration outcome:

- 32 historical artifacts archived under docs/legacy.
- No historical artifact deletion.
- No project-scoped overwrite during migration.
- Root-level artifact directories no longer carry mixed outputs.
- Re-run behavior validated as no-op (idempotent).

This establishes filesystem-level clarity consistent with Phase 3 architecture.

## Consequences

### Positive

- Canonical artifact contract is explicit and enforceable.
- Historical truth preserved in a clear archive boundary.
- Reduced ambiguity for maintainers and automation.
- Better foundation for multi-project and scale workflows.

### Trade-offs

- Additional migration and compliance scripts to maintain.
- Existing references to root-level paths must be updated when encountered.

### Risks and Mitigations

- Risk: drift back to root-level writes.
  - Mitigation: verification script and canonical documentation.
- Risk: archive confusion.
  - Mitigation: docs/legacy/README.md and layout guides.

## Non-Goals

- No content rewriting of historical artifacts.
- No schema changes to event or artifact payloads.
- No semantic generator behavior change.

## Milestone Significance

This ADR marks a pre-scale milestone: filesystem and writer behavior now match project-scoped architecture, enabling reliable expansion without losing historical provenance.

## Related Artifacts

- docs/ARTIFACT-LAYOUT.md
- docs/ARTIFACT-CLEANUP-SUMMARY.md
- docs/EXECUTIVE-SUMMARY.md
- docs/IMPLEMENTATION-CHECKLIST.md
- docs/legacy/README.md

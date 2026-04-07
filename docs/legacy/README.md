# Legacy Artifacts Archive

This directory contains artifacts generated before Phase 3 project-scoped routing changes.

## Structure

- `adr/` — Architecture Decision Records (pre-Phase 3)
- `sessions/` — Session summaries (pre-Phase 3)
- `posts/` — Blog/social posts (pre-Phase 3)
- `contracts/` — Build contracts and summaries (pre-Phase 3)
- `prompts/` — System prompts (pre-Phase 3)

## Canonical Layout (Post-Phase 3)

New artifacts are now written to project-scoped directories:

```
docs/
  <project_id>/
    adr/
    sessions/
    posts/
    contracts/
    prompts/
  legacy/
    adr/        ← Pre-Phase 3 artifacts
    sessions/
    posts/
    contracts/
    prompts/
```

## Why This Archive?

Phase 3 introduced project-aware artifact routing. The root-level `adr/`, `sessions/`, `posts/`, `contracts/`, and `prompts/` directories were used for artifact output before this routing layer was established.

To:
1. **Preserve historical artifacts** without deletion
2. **Clarify canonical layout** for new writers
3. **Avoid mixing** pre- and post-Phase 3 artifacts

...all pre-Phase 3 root-level artifacts were moved here.

## Accessing Legacy Artifacts

All files are preserved exactly as they were created. You can reference them from `docs/legacy/{type}/{filename}`.

## Future Artifact Generation

New artifacts should always write to:
`docs/{project_id}/{type}/{filename}`

See [Phase 3 Build Contract](../contracts/Phase-3-Build-Contract.md) for routing details.

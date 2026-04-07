# SignalForge Artifact Layout

## Canonical Layout (Post-Phase 3)

All new artifacts are written to **project-scoped directories**:

```
docs/
  {project_id}/              ← Project-scoped artifacts
    adr/
      {dispatch_id}.md       ← Architecture Decision Records
      {dispatch_id}.md
    sessions/
      {session_id}.md        ← Session summaries
    contracts/
      {dispatch_id}.md       ← Build contracts and dispatch records
    prompts/
      {dispatch_id}.md       ← System prompts for materialization
    posts/
      {dispatch_id}.md       ← Blog/social post artifacts
  legacy/                    ← Pre-Phase 3 artifacts (read-only archive)
    adr/
    sessions/
    contracts/
    prompts/
    posts/
    README.md                ← Explanation and access guide
```

## Project ID

`project_id` is derived from:
1. **Workspace root path** — normalized and hashed
2. **Optional user alias** — for stable, human-readable project identity (future KSIL naming layer)

Example generated `project_id`: `proj_5f8d3a1b` or user-aliased: `my-workspace`

## Artifact Writers

All artifact writers (generators, scripts, extensions) **must route to project-scoped paths**:

### Current Writers

| Writer | Location | Responsible For | Status |
|--------|----------|---|---|
| `adrGenerator.ts` | `packages/core/src/artifacts/` | ADR generation | ✓ Generates content (no file I/O) |
| `sessionSummary.ts` | `packages/core/src/sessions/` | Session summary generation | ✓ Generates content (no file I/O) |
| `dispatchCompiler.ts` | `packages/core/src/dispatch/` | Contracts & prompts | ✓ **Updated to use project-scoped paths** |
| `materialize_from_inmemory.js` | `scripts/` | CLI materialization from in-memory DB | ✓ **Updated to use project-scoped paths** |
| VS Code extension | `apps/vscode-extension/src/` | Event capture & dispatch invocation | ✓ Calls `compileDispatch` with `projectId` |

### Output Paths by Writer

#### dispatchCompiler.ts
```
docs/{project_id}/contracts/{chat_thread_id}.md
docs/{project_id}/prompts/{chat_thread_id}.md
```

#### materialize_from_inmemory.js
```
docs/{project_id}/contracts/{thread_id}.md
docs/{project_id}/prompts/{thread_id}.md
```

## Adding New Artifact Writers

When creating a new writer (ADR generator, session exporter, etc.):

1. **Receive or derive `project_id`** from event context
2. **Route to `docs/{project_id}/{artifact_type}/`**
3. **Use canonical filename patterns**:
   - ADRs: `{dispatch_id}.md` or `{session_id}.md`
   - Sessions: `{session_id}.md`
   - Contracts: `{dispatch_id}.md`
   - Prompts: `{dispatch_id}.md`
   - Posts: `{dispatch_id}.md`

### Example (TypeScript)

```typescript
import fs from 'fs';
import path from 'path';

function writeArtifact(content: string, projectId: string, artifactType: 'adr' | 'session' | 'contract', filename: string, baseDir: string = process.cwd()) {
  // Ensure project-scoped directory exists
  const dir = path.join(baseDir, 'docs', projectId, artifactType);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  // Write to canonical location
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  
  return filePath;
}

// Usage
const adrPath = writeArtifact(adrContent, 'proj_123', 'adr', 'dispatch_xyz.md');
```

## Legacy Artifacts

All pre-Phase 3 artifacts are preserved in `docs/legacy/` and are **read-only**.

To reference them:
```
docs/legacy/{artifact_type}/{filename}
```

These artifacts will not be regenerated or moved. They serve as a historical record of SignalForge before project-scoped routing was implemented.

## Validation

### Checklist for New Implementations

- [ ] `project_id` is passed through event context or derived from workspace
- [ ] All file writes target `docs/{project_id}/{type}/` directories
- [ ] No artifacts written to root-level `docs/{type}/` paths
- [ ] Filename patterns follow canonical conventions
- [ ] No artifacts are written to `docs/legacy/` (this is an archive)
- [ ] Error handling includes fallback `project_id` (e.g., `'unknown-project'`) for robustness

### Testing

Run the migration script idempotently to verify all writers are using project-scoped paths:

```bash
node scripts/migrate-legacy-artifacts.js --dry-run --verbose
```

Should show:
```
Total files processed: 0
Files moved: 0
Files skipped: 0
```

(No root-level legacy directories remain to migrate)

## Phase 3 Routing Impact

Phase 3 introduced project context binding and dispatch-to-execution tracing:

1. **Every event includes `project_id`** — enforced at session creation
2. **Artifacts route by project** — enabling multi-project workspaces
3. **Dispatch linking** — traces from dispatch → events → outcomes → artifacts
4. **Deterministic generation** — artifact writers use canonical events

This layout ensures:
- ✓ Clear separation of pre- and post-Phase 3 artifacts
- ✓ Multi-project support going forward
- ✓ Historical artifact accessibility (no deletions)
- ✓ Filesystem clarity (canonical layout matches architecture)
- ✓ Future extensibility (phase-N artifact types can follow same pattern)

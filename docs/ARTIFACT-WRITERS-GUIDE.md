# Artifact Writers Quick Reference

> How to route SignalForge artifacts to the canonical project-scoped layout.

## TL;DR

**Write all new artifacts to**:
```
docs/{project_id}/{artifact_type}/{filename}
```

**NOT to** (deprecated):
```
❌ docs/{artifact_type}/{filename}
```

## Required Fields

Every artifact write needs:

| Field | Source | Example |
|-------|--------|---------|
| `project_id` | Event context or `deriveProjectId()` | `proj_5f8d3a1b` or `my-workspace` |
| `artifact_type` | `adr` \| `session` \| `contract` \| `prompt` \| `post` | `contract` |
| `filename` | Dispatch/Session ID + `.md` | `dsp_xyz123.md` |
| `baseDir` | Workspace root | `/path/to/SignalForge` |

## Patterns by Language

### TypeScript

```typescript
import fs from 'fs';
import path from 'path';

function writeArtifact(
  content: string,
  projectId: string,
  artifactType: 'adr' | 'session' | 'contract' | 'prompt' | 'post',
  filename: string,
  baseDir = process.cwd()
): string {
  // Create project-scoped directory
  const dir = path.join(baseDir, 'docs', projectId, artifactType);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  // Write artifact
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  
  return filePath;
}

// Usage
const adrPath = writeArtifact(
  adrContent,
  'proj_123',
  'adr',
  'dispatch_xyz.md'
);
// → docs/proj_123/adr/dispatch_xyz.md
```

### JavaScript

```javascript
const fs = require('fs');
const path = require('path');

function writeArtifact(content, projectId, artifactType, filename, baseDir = process.cwd()) {
  const dir = path.join(baseDir, 'docs', projectId, artifactType);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  
  return filePath;
}

// Usage
const contractPath = writeArtifact(
  contractContent,
  projectId,
  'contracts',
  `${threadId}.md`
);
// → docs/{projectId}/contracts/{threadId}.md
```

## Getting project_id

### From Events
```typescript
// Events include project_id
const events = await getChatEventsByThread(db, threadId);
const projectId = events[0]?.project_id ?? 'unknown-project';
```

### Deriving from Workspace
```typescript
import { deriveProjectId } from '@signalforge/core/projects/projectService';

const projectId = deriveProjectId(workspaceRoot, optionalAlias);
```

### In VS Code Extension
```typescript
// Option 1: From pinned project
const pinnedProject = context.globalState.get('signalforge.pinnedProject');
const projectId = pinnedProject?.projectId;

// Option 2: Derive from workspace
const folders = vscode.workspace.workspaceFolders;
const projectId = deriveProjectId(folders[0].uri.fsPath);
```

## Examples

### ADR Generation

```typescript
import { buildADR } from '@signalforge/core/artifacts/adrGenerator';

// Generate ADR content
const adrContent = buildADR(events);

// Extract project_id from events
const projectId = events[0]?.project_id ?? 'unknown-project';

// Write to project-scoped path
const adrPath = path.join(process.cwd(), 'docs', projectId, 'adr');
if (!fs.existsSync(adrPath)) fs.mkdirSync(adrPath, { recursive: true });
fs.writeFileSync(
  path.join(adrPath, `${dispatchId}.md`),
  adrContent
);
// → docs/{projectId}/adr/{dispatchId}.md
```

### Session Summary Export

```typescript
import { buildSessionSummary } from '@signalforge/core/sessions/sessionSummary';

const sessionContent = buildSessionSummary(events);
const projectId = events[0]?.project_id ?? 'unknown-project';
const sessionDir = path.join(workspaceRoot, 'docs', projectId, 'sessions');

if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
fs.writeFileSync(path.join(sessionDir, `${sessionId}.md`), sessionContent);
// → docs/{projectId}/sessions/{sessionId}.md
```

### Dispatch Compiler (Contract + Prompts)

```typescript
// Already updated in dispatchCompiler.ts
async function compileDispatch(threadId, db, options?) {
  const projectId = options?.projectId || events[0]?.project_id || 'unknown-project';
  
  // Routes contracts to: docs/{projectId}/contracts/
  const contractDir = path.resolve(baseDir, 'docs', projectId, 'contracts');
  
  // Routes prompts to: docs/{projectId}/prompts/
  const promptsDir = path.resolve(baseDir, 'docs', projectId, 'prompts');
  
  // ... rest of implementation
}
```

## Migration from Old Paths

If updating an existing writer:

**Before** ❌
```typescript
const contractDir = path.resolve('docs', 'contracts');
fs.writeFileSync(path.join(contractDir, `${id}.md`), content);
```

**After** ✅
```typescript
const projectId = events[0]?.project_id ?? 'unknown-project';
const contractDir = path.resolve('docs', projectId, 'contracts');
fs.writeFileSync(path.join(contractDir, `${id}.md`), content);
```

## Validation

### Pre-Commit Check

Ensure your writer:
- [ ] Receives or derives `project_id`
- [ ] Routes to `docs/{project_id}/{type}/`
- [ ] Creates directories recursively (`{ recursive: true }`)
- [ ] Uses `.md` extension for file artifacts
- [ ] Has fallback `project_id` for robustness

### Test Verification

Run validation script:
```bash
node scripts/verify-artifact-layout.js
```

Should show:
```
✅ COMPLIANT — Artifact layout meets Phase 3 canonical structure.
```

## Reference

- **Layout Guide**: [docs/ARTIFACT-LAYOUT.md](../ARTIFACT-LAYOUT.md)
- **Legacy Archive**: [docs/legacy/README.md](../legacy/README.md)
- **Migration Summary**: [docs/ARTIFACT-CLEANUP-SUMMARY.md](../ARTIFACT-CLEANUP-SUMMARY.md)
- **Verification Script**: [scripts/verify-artifact-layout.js](../../scripts/verify-artifact-layout.js)

## Questions?

See comprehensive documentation at [docs/ARTIFACT-LAYOUT.md](../ARTIFACT-LAYOUT.md) or contact the SignalForge team.

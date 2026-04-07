# SignalForge Artifact Layout — Quick Start

## What Changed?

✅ **Old (Legacy)**: Artifacts stored in root-level `docs/adr/`, `docs/contracts/`, `docs/prompts/`  
✅ **New (Canonical)**: Artifacts stored in `docs/{project_id}/{type}/`  
✅ **Preserved**: All 32 pre-Phase 3 artifacts safely archived in `docs/legacy/`  

## For Everyone

**Where are my artifacts?**
- **New artifacts**: `docs/{project_id}/{type}/{filename}`
  - Example: `docs/proj_123/contracts/dispatch_abc.md`
- **Old artifacts**: `docs/legacy/{type}/{filename}`
  - Example: `docs/legacy/adr/ADR-Phase2.md`

## For Developers

**Writing new artifacts?** Use project-scoped paths:

```typescript
const projectId = events[0]?.project_id ?? 'unknown-project';
const artifactPath = path.join(baseDir, 'docs', projectId, 'adr', `${id}.md`);
```

See: [ARTIFACT-WRITERS-GUIDE.md](docs/ARTIFACT-WRITERS-GUIDE.md)

## For Operations

**Verification**:
```bash
node scripts/verify-artifact-layout.js
# Shows: ✅ COMPLIANT
```

**Legacy archive**:
```bash
ls docs/legacy/
# Contains: adr/ contracts/ prompts/ README.md
```

## For Architects

**Canonical layout**:
```
docs/
├── {project_id}/        ← New artifacts
│   ├── adr/
│   ├── sessions/
│   ├── contracts/
│   ├── prompts/
│   └── posts/
└── legacy/              ← Pre-Phase 3 (read-only)
    ├── adr/
    ├── contracts/
    └── prompts/
```

See: [ARTIFACT-LAYOUT.md](docs/ARTIFACT-LAYOUT.md)

## Key Resources

| Document | Purpose |
|----------|---------|
| [ARTIFACT-LAYOUT.md](docs/ARTIFACT-LAYOUT.md) | Comprehensive layout & patterns |
| [ARTIFACT-WRITERS-GUIDE.md](docs/ARTIFACT-WRITERS-GUIDE.md) | Developer quick reference |
| [EXECUTIVE-SUMMARY.md](docs/EXECUTIVE-SUMMARY.md) | Strategic overview |
| [legacy/README.md](docs/legacy/README.md) | Archive explanation |

## Verification

✅ **Status**: All systems verified compliant  
✅ **Files migrated**: 32  
✅ **Breaking changes**: 0  
✅ **Data loss**: 0  

---

**Questions?** Check [docs/](docs/) for comprehensive guides.  
**More info?** See [ARTIFACT-CLEANUP-COMPLETE.md](ARTIFACT-CLEANUP-COMPLETE.md)

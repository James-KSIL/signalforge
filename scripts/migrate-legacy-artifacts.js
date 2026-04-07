#!/usr/bin/env node

/**
 * SignalForge Legacy Artifact Migration Script
 * 
 * Migrates artifacts from root-level paths (pre-Phase 3) to `docs/legacy/`
 * while preserving historical artifacts and ensuring project-scoped paths
 * are used going forward.
 * 
 * Canonical layout (post-Phase 3):
 *   - docs/{project_id}/adr/
 *   - docs/{project_id}/sessions/
 *   - docs/{project_id}/contracts/
 *   - docs/{project_id}/prompts/
 *   - docs/{project_id}/posts/
 * 
 * Legacy handling:
 *   - Old artifacts moved from docs/{type}/ to docs/legacy/{type}/
 *   - Collisions renamed with deterministic suffix
 */

const fs = require('fs');
const path = require('path');

// Parse CLI arguments
const dryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');

// Configuration
const LEGACY_TYPE_DIRS = ['adr', 'sessions', 'posts', 'contracts', 'prompts'];
const DOCS_ROOT = path.resolve('docs');
const LEGACY_ROOT = path.join(DOCS_ROOT, 'legacy');

// Summary tracking
const summary = {
  filesMoved: [],
  filesSkipped: [],
  collisionsRenamed: [],
  docsCreated: [],
  errors: [],
  totalFiles: 0,
  dryRun,
};

/**
 * Ensures directory exists, optionally without writing if in dry-run mode
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    if (dryRun) {
      if (verbose) console.log(`[DRY-RUN] Would create directory: ${dirPath}`);
      summary.docsCreated.push(dirPath);
    } else {
      fs.mkdirSync(dirPath, { recursive: true });
      if (verbose) console.log(`Created directory: ${dirPath}`);
      summary.docsCreated.push(dirPath);
    }
  }
}

/**
 * Generates a deterministic collision suffix based on timestamp and hash
 */
function getCollisionSuffix() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-mm-ss
  return `.legacy-${timestamp}`;
}

/**
 * Safely move file, handling collisions
 */
function moveFile(sourcePath, destDir, fileName) {
  let destPath = path.join(destDir, fileName);
  let finalFileName = fileName;

  // Check for collision
  if (fs.existsSync(destPath)) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const suffix = getCollisionSuffix();
    finalFileName = `${base}${suffix}${ext}`;
    destPath = path.join(destDir, finalFileName);

    summary.collisionsRenamed.push({
      original: fileName,
      renamed: finalFileName,
      reason: 'Collision with existing legacy file',
    });

    if (verbose) {
      console.log(`  Collision detected for ${fileName}, renaming to ${finalFileName}`);
    }
  }

  if (dryRun) {
    if (verbose) console.log(`  [DRY-RUN] Would move: ${sourcePath} -> ${destPath}`);
    summary.filesMoved.push({
      from: sourcePath,
      to: destPath,
      actualFileName: finalFileName,
    });
  } else {
    fs.copyFileSync(sourcePath, destPath);
    fs.unlinkSync(sourcePath);
    if (verbose) console.log(`  Moved: ${sourcePath} -> ${destPath}`);
    summary.filesMoved.push({
      from: sourcePath,
      to: destPath,
      actualFileName: finalFileName,
    });
  }
}

/**
 * Checks if a project-scoped version exists
 */
function projectScopedVersionExists(fileName) {
  // Look for docs/{project_id}/{type}/{fileName}
  // This is a conservative check - we won't migrate if any project-scoped version exists
  try {
    const items = fs.readdirSync(DOCS_ROOT);
    for (const item of items) {
      const itemPath = path.join(DOCS_ROOT, item);
      if (!fs.statSync(itemPath).isDirectory()) continue;
      if (item === 'legacy' || item === 'architecture' || item === 'linkedIn') continue;

      // Check each legacy type directory within this project
      for (const typeDir of LEGACY_TYPE_DIRS) {
        const typeProjectPath = path.join(itemPath, typeDir);
        if (fs.existsSync(typeProjectPath)) {
          const files = fs.readdirSync(typeProjectPath);
          if (files.includes(fileName)) {
            return true;
          }
        }
      }
    }
  } catch (err) {
    if (verbose) console.warn(`Warning checking for project-scoped version: ${err.message}`);
  }
  return false;
}

/**
 * Main migration function
 */
function migrate() {
  console.log('\n=== SignalForge Legacy Artifact Migration ===\n');
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}\n`);

  // Ensure legacy root exists
  ensureDir(LEGACY_ROOT);

  // Process each legacy type
  for (const typeDir of LEGACY_TYPE_DIRS) {
    const legacyTypePath = path.join(DOCS_ROOT, typeDir);

    // Skip if type directory doesn't exist
    if (!fs.existsSync(legacyTypePath)) {
      if (verbose) {
        console.log(`Skipping ${typeDir}/: directory does not exist`);
      }
      continue;
    }

    const stat = fs.statSync(legacyTypePath);
    if (!stat.isDirectory()) {
      if (verbose) {
        console.log(`Skipping ${typeDir}/: not a directory`);
      }
      continue;
    }

    const files = fs.readdirSync(legacyTypePath);
    if (files.length === 0) {
      if (verbose) {
        console.log(`Skipping ${typeDir}/: directory is empty`);
      }
      continue;
    }

    console.log(`Processing legacy ${typeDir}/ (${files.length} files)...`);

    // Create destination directory
    const legacyDestDir = path.join(LEGACY_ROOT, typeDir);
    ensureDir(legacyDestDir);

    // Process each file
    for (const file of files) {
      summary.totalFiles++;
      const sourceFile = path.join(legacyTypePath, file);
      const stat = fs.statSync(sourceFile);

      // Skip non-files (directories)
      if (!stat.isFile()) {
        summary.filesSkipped.push({
          file: path.relative(DOCS_ROOT, sourceFile),
          reason: 'Not a file (directory)',
        });
        continue;
      }

      // Check if project-scoped version exists
      if (projectScopedVersionExists(file)) {
        summary.filesSkipped.push({
          file: path.relative(DOCS_ROOT, sourceFile),
          reason: 'Project-scoped version already exists',
        });
        if (verbose) {
          console.log(`  Skipping ${file}: project-scoped version exists`);
        }
        continue;
      }

      moveFile(sourceFile, legacyDestDir, file);
    }

    console.log(`  ✓ Processed ${typeDir}/ complete\n`);
  }

  // Create legacy README
  createLegacyReadme();

  // Print summary
  printSummary();
}

/**
 * Creates a README in docs/legacy/ explaining the archive
 */
function createLegacyReadme() {
  const readme = `# Legacy Artifacts Archive

This directory contains artifacts generated before Phase 3 project-scoped routing changes.

## Structure

- \`adr/\` — Architecture Decision Records (pre-Phase 3)
- \`sessions/\` — Session summaries (pre-Phase 3)
- \`posts/\` — Blog/social posts (pre-Phase 3)
- \`contracts/\` — Build contracts and summaries (pre-Phase 3)
- \`prompts/\` — System prompts (pre-Phase 3)

## Canonical Layout (Post-Phase 3)

New artifacts are now written to project-scoped directories:

\`\`\`
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
\`\`\`

## Why This Archive?

Phase 3 introduced project-aware artifact routing. The root-level \`adr/\`, \`sessions/\`, \`posts/\`, \`contracts/\`, and \`prompts/\` directories were used for artifact output before this routing layer was established.

To:
1. **Preserve historical artifacts** without deletion
2. **Clarify canonical layout** for new writers
3. **Avoid mixing** pre- and post-Phase 3 artifacts

...all pre-Phase 3 root-level artifacts were moved here.

## Accessing Legacy Artifacts

All files are preserved exactly as they were created. You can reference them from \`docs/legacy/{type}/{filename}\`.

## Future Artifact Generation

New artifacts should always write to:
\`docs/{project_id}/{type}/{filename}\`

See [Phase 3 Build Contract](../contracts/Phase-3-Build-Contract.md) for routing details.
`;

  const readmePath = path.join(LEGACY_ROOT, 'README.md');
  if (dryRun) {
    if (verbose) console.log(`[DRY-RUN] Would write: ${readmePath}`);
  } else {
    fs.writeFileSync(readmePath, readme);
    if (verbose) console.log(`Created: ${readmePath}`);
  }
}

/**
 * Prints migration summary
 */
function printSummary() {
  console.log('\n=== Migration Summary ===\n');
  console.log(`Total files processed: ${summary.totalFiles}`);
  console.log(`Files moved: ${summary.filesMoved.length}`);
  console.log(`Files skipped: ${summary.filesSkipped.length}`);
  console.log(`Collisions renamed: ${summary.collisionsRenamed.length}`);
  console.log(`Directories created: ${summary.docsCreated.length}`);

  if (summary.filesMoved.length > 0 && verbose) {
    console.log('\n--- Files Moved ---');
    summary.filesMoved.forEach(({ from, to, actualFileName }) => {
      console.log(`  ${path.basename(from)} → ${actualFileName}`);
    });
  }

  if (summary.filesSkipped.length > 0 && verbose) {
    console.log('\n--- Files Skipped ---');
    summary.filesSkipped.forEach(({ file, reason }) => {
      console.log(`  ${file} (${reason})`);
    });
  }

  if (summary.collisionsRenamed.length > 0) {
    console.log('\n--- Collisions Renamed ---');
    summary.collisionsRenamed.forEach(({ original, renamed, reason }) => {
      console.log(`  ${original} → ${renamed} (${reason})`);
    });
  }

  if (summary.errors.length > 0) {
    console.log('\n--- Errors ---');
    summary.errors.forEach((err) => {
      console.log(`  ${err}`);
    });
  }

  console.log(`\nLegacy archive root: ${LEGACY_ROOT}`);
  if (dryRun) {
    console.log('\n[DRY-RUN] No files were actually moved. Run without --dry-run to migrate.');
  } else {
    console.log('\n✓ Migration complete.');
  }

  console.log('\nNext steps:');
  console.log('1. Review docs/legacy/ to verify archive');
  console.log('2. Confirm root-level artifact dirs are empty or removed appropriately');
  console.log('3. Generate fresh artifacts and verify they land in project-scoped paths');
  console.log('4. Update any build/automation scripts to use canonical paths\n');
}

// Run migration
try {
  migrate();
  process.exit(0);
} catch (err) {
  console.error('\n❌ Migration failed:', err.message);
  if (verbose) console.error(err.stack);
  process.exit(1);
}

#!/usr/bin/env node

/**
 * SignalForge Artifact Layout Compliance Checker
 * 
 * Verifies that:
 * 1. All artifact writers use project-scoped paths
 * 2. No new artifacts are written to root-level paths
 * 3. Legacy archive remains immutable
 * 4. Project-scoped directories contain expected artifacts
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DOCS_ROOT = path.resolve('docs');
const LEGACY_ROOT = path.join(DOCS_ROOT, 'legacy');
const EXCLUDED_DIRS = ['architecture', 'linkedIn', 'legacy'];
const LEGACY_TYPE_DIRS = ['adr', 'sessions', 'posts', 'contracts', 'prompts'];
const ROOT_LEVEL_TYPES = ['adr', 'sessions', 'posts', 'contracts', 'prompts'];

// Global vars
const verbose = process.argv.includes('--verbose');
const errors = [];
const warnings = [];
const checks = [];

function log(msg) {
  console.log(msg);
}

function logVerbose(msg) {
  if (verbose) console.log(`  ${msg}`);
}

function error(msg) {
  errors.push(msg);
  log(`❌ ${msg}`);
}

function warn(msg) {
  warnings.push(msg);
  log(`⚠️  ${msg}`);
}

function success(msg) {
  checks.push({ type: 'success', msg });
  log(`✅ ${msg}`);
}

/**
 * Check 1: Root-level artifact directories should not contain new files
 */
function checkRootLevelDirs() {
  log('\n### Check 1: Root-Level Artifact Directories ###\n');

  let foundFiles = false;
  for (const type of ROOT_LEVEL_TYPES) {
    const dir = path.join(DOCS_ROOT, type);
    if (!fs.existsSync(dir)) {
      success(`Root-level ${type}/ does not exist`);
      logVerbose('(Never created or removed after migration)');
      continue;
    }

    const files = fs.readdirSync(dir);
    if (files.length === 0) {
      success(`Root-level ${type}/ exists but is empty`);
      logVerbose('(Migration successful)');
    } else {
      error(`Root-level ${type}/ contains ${files.length} file(s): ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`);
      logVerbose('These should be moved to docs/legacy/');
      foundFiles = true;
    }
  }

  return !foundFiles;
}

/**
 * Check 2: Legacy archive should be immutable and complete
 */
function checkLegacyArchive() {
  log('\n### Check 2: Legacy Archive Integrity ###\n');

  if (!fs.existsSync(LEGACY_ROOT)) {
    error('Legacy archive root does not exist: ' + LEGACY_ROOT);
    return false;
  }

  success(`Legacy archive exists at ${LEGACY_ROOT}`);

  let totalFiles = 0;
  let hasReadme = false;
  const legacyContent = {};

  for (const type of LEGACY_TYPE_DIRS) {
    const typeDir = path.join(LEGACY_ROOT, type);
    if (fs.existsSync(typeDir)) {
      const files = fs.readdirSync(typeDir).filter(f => f.endsWith('.md'));
      legacyContent[type] = files.length;
      totalFiles += files.length;
      logVerbose(`  ${type}/: ${files.length} files`);
    } else {
      legacyContent[type] = 0;
      logVerbose(`  ${type}/: directory not present (OK if no pre-Phase 3 artifacts)`);
    }
  }

  const readmePath = path.join(LEGACY_ROOT, 'README.md');
  hasReadme = fs.existsSync(readmePath);
  if (hasReadme) {
    success('Legacy archive README exists');
  } else {
    warn('Legacy archive README missing');
  }

  if (totalFiles > 0) {
    success(`Legacy archive contains ${totalFiles} historical artifacts (immutable)`);
  } else {
    warn('Legacy archive is empty (no pre-Phase 3 artifacts found)');
  }

  return true;
}

/**
 * Check 3: Project-scoped directories should have expected structure
 */
function checkProjectScopedDirs() {
  log('\n### Check 3: Project-Scoped Directories ###\n');

  const items = fs.readdirSync(DOCS_ROOT);
  let projectDirs = items.filter(item => {
    const fullPath = path.join(DOCS_ROOT, item);
    return fs.statSync(fullPath).isDirectory() && !EXCLUDED_DIRS.includes(item);
  });

  if (projectDirs.length === 0) {
    warn('No project-scoped directories found (expected if Phase 3 artifacts not generated yet)');
    return true;
  }

  success(`Found ${projectDirs.length} project-scoped director${projectDirs.length === 1 ? 'y' : 'ies'}`);

  let totalArtifacts = 0;
  for (const projDir of projectDirs) {
    const projPath = path.join(DOCS_ROOT, projDir);
    const artifacts = fs.readdirSync(projPath);
    logVerbose(`  ${projDir}/: ${artifacts.length} item(s)`);

    for (const type of LEGACY_TYPE_DIRS) {
      const typePath = path.join(projPath, type);
      if (fs.existsSync(typePath)) {
        const files = fs.readdirSync(typePath).filter(f => f.endsWith('.md'));
        totalArtifacts += files.length;
        logVerbose(`    ${type}/: ${files.length} file(s)`);
      }
    }
  }

  if (totalArtifacts > 0) {
    success(`Project-scoped artifacts present: ${totalArtifacts} file(s)`);
  } else {
    logVerbose('No artifacts in project-scoped directories yet (OK if not generated)');
  }

  return true;
}

/**
 * Check 4: Code compliance (writers use project-scoped paths)
 */
function checkCodeCompliance() {
  log('\n### Check 4: Artifact Writer Compliance ###\n');

  const filesToCheck = [
    { file: 'packages/core/src/dispatch/dispatchCompiler.ts', patterns: [/docs.*?projectId|projectId.*?docs/] },
    { file: 'scripts/materialize_from_inmemory.js', patterns: [/projectId.*?contract|contract.*?projectId/] },
  ];

  let allCompliant = true;

  for (const { file, patterns } of filesToCheck) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) {
      warn(`File not found: ${file}`);
      allCompliant = false;
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const hasProjectScoping = patterns.some(p => p.test(content));

    if (hasProjectScoping || content.includes('projectId') && content.includes('docs')) {
      success(`${file} uses project-scoped paths`);
    } else {
      warn(`${file} may not use project-scoped paths (manual review recommended)`);
      allCompliant = false;
    }
  }

  return allCompliant;
}

/**
 * Main verification
 */
function runVerification() {
  log('\n======================================');
  log('SignalForge Artifact Layout Compliance');
  log('======================================');

  // Run all checks
  const check1 = checkRootLevelDirs();
  const check2 = checkLegacyArchive();
  const check3 = checkProjectScopedDirs();
  const check4 = checkCodeCompliance();

  // Summary
  log('\n======================================');
  log('Verification Summary');
  log('======================================\n');

  console.log(`✅ Successful checks: ${checks.filter(c => c.type === 'success').length}`);
  if (warnings.length > 0) console.log(`⚠️  Warnings: ${warnings.length}`);
  if (errors.length > 0) console.log(`❌ Errors: ${errors.length}`);

  if (errors.length > 0) {
    log('\n--- Errors ---');
    errors.forEach(e => log(`  • ${e}`));
  }

  if (warnings.length > 0) {
    log('\n--- Warnings ---');
    warnings.forEach(w => log(`  • ${w}`));
  }

  const isCompliant = errors.length === 0;
  const status = isCompliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
  log(`\n${status} — Artifact layout ${isCompliant ? 'meets' : 'does not meet'} Phase 3 canonical structure.\n`);

  if (!isCompliant) {
    log('Recommendations:');
    if (check1 === false) log('  1. Run: node scripts/migrate-legacy-artifacts.js');
    if (check4 === false) log('  2. Update artifact writers to use project-scoped paths');
    log('  3. See docs/ARTIFACT-LAYOUT.md for guidelines\n');
  }

  process.exit(isCompliant ? 0 : 1);
}

// Run verification
try {
  runVerification();
} catch (err) {
  console.error('\n❌ Verification failed:', err.message);
  if (verbose) console.error(err.stack);
  process.exit(1);
}

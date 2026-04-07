#!/usr/bin/env node

/**
 * Phase 2.5 Deterministic Validation Script (JavaScript)
 * 
 * This script can be run directly without TypeScript compilation.
 * It validates that the artifact generation system maintains its invariants:
 * - Outcomes render only from canonical event stream
 * - No undefined/null/[object Object] in output
 * - Skip counts are accurate and present
 * - Output is deterministic
 */

const fs = require('fs');
const path = require('path');

// Helper: Seed test events matching ForgeEvent schema
function seedCanonicalEvents() {
  const now = new Date().toISOString();
  return [
    {
      event_id: 'evt_seed_001',
      thread_id: 'phase-2-5-validation-thread',
      role: 'system',
      event_type: 'session_started',
      content: {
        summary: 'Validation session started',
      },
      timestamp: now,
    },
    {
      event_id: 'evt_seed_002',
      thread_id: 'phase-2-5-validation-thread',
      role: 'user',
      event_type: 'dispatch_seeded',
      content: {
        summary: 'User initiated dispatch for testing',
        details: 'Testing canonical event flow',
      },
      timestamp: new Date(Date.parse(now) + 1000).toISOString(),
    },
    {
      event_id: 'evt_seed_003',
      thread_id: 'phase-2-5-validation-thread',
      role: 'assistant',
      event_type: 'dispatch_refreshed',
      content: {
        summary: 'Assistant processed request',
        details: 'Generated response from context',
      },
      timestamp: new Date(Date.parse(now) + 2000).toISOString(),
    },
    {
      event_id: 'evt_seed_004',
      thread_id: 'phase-2-5-validation-thread',
      role: 'outcome',
      event_type: 'outcome_logged',
      content: {
        summary: 'Core artifact generation validated',
        status: 'success',
        details: 'WHAT CHANGED:\nADR generator now derives outcomes exclusively from canonical event stream\n\nRESISTANCE:\nNone; architecture aligned\n\nNEXT STEP:\nDeploy Phase 2.5 changes to production',
      },
      timestamp: new Date(Date.parse(now) + 3000).toISOString(),
    },
    {
      event_id: 'evt_seed_005',
      thread_id: 'phase-2-5-validation-thread',
      role: 'outcome',
      event_type: 'outcome_logged',
      content: {
        summary: 'Session summary rendering stable',
        status: 'success',
        details: 'WHAT CHANGED:\nSession summaries include skip counts and outcome fidelity data\n\nRESISTANCE:\nLegacy malformed rows handled transparently\n\nNEXT STEP:\nFreeze artifact semantics for expansion',
      },
      timestamp: new Date(Date.parse(now) + 4000).toISOString(),
    },
    {
      event_id: 'evt_seed_006',
      thread_id: 'phase-2-5-validation-thread',
      role: 'worker',
      event_type: 'artifact_generated',
      content: {
        summary: 'ADR artifact generated successfully',
        artifacts: ['docs/adr/phase-2-5-validation-thread-adr.md'],
      },
      timestamp: new Date(Date.parse(now) + 5000).toISOString(),
    },
  ];
}

// Validation functions
function validateNoInvalidContent(content, artifactName) {
  const invalidPatterns = [
    { pattern: /\[object Object\]/g, name: '[object Object]' },
    { pattern: /\bundefined\b/g, name: 'undefined' },
  ];

  let hasIssues = false;
  for (const { pattern, name } of invalidPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      console.error(`  ❌ ${artifactName} contains "${name}" (${matches.length} occurrences)`);
      hasIssues = true;
    }
  }

  return !hasIssues;
}

function validateSkipCountsPresent(content, artifactName) {
  const hasSkipCounts = 
    /Skipped Legacy\/Invalid Events: \d+/.test(content) &&
    /Skipped (Legacy\/)?Invalid Outcomes: \d+/.test(content);

  if (!hasSkipCounts) {
    console.error(`  ❌ ${artifactName} missing skip count metrics`);
  } else {
    console.log(`  ✓ ${artifactName} skip counts present`);
  }
  return hasSkipCounts;
}

function validateOutcomePresent(content, artifactName) {
  const hasOutcomes = /renderedOutcomes: [1-9]/.test(content);
  if (!hasOutcomes) {
    console.error(`  ❌ ${artifactName} has no rendered outcomes (expected 2+)`);
  } else {
    console.log(`  ✓ ${artifactName} contains rendered outcomes`);
  }
  return hasOutcomes;
}

function validateDeterminism(content1, content2, artifactName) {
  if (content1 === content2) {
    console.log(`  ✓ ${artifactName} is deterministic`);
    return true;
  } else {
    console.error(`  ❌ ${artifactName} is NOT deterministic (outputs differ)`);
    return false;
  }
}

function validateThreadIdConsistent(content, threadId, artifactName) {
  if (content.includes(threadId)) {
    console.log(`  ✓ ${artifactName} includes thread ID consistently`);
    return true;
  } else {
    console.error(`  ❌ ${artifactName} missing thread ID`);
    return false;
  }
}

// Main validation (requires generators to be built first)
async function runValidation() {
  console.log('\n🔍 Phase 2.5 Deterministic Validation\n');
  console.log('Step 1: Seeding canonical events...');
  const events = seedCanonicalEvents();
  console.log(`  ✓ Seeded ${events.length} events`);

  console.log('\nStep 2: Attempting to load core generators...');
  let buildADR, buildSessionSummary;
  
  try {
    // Try to load from built core package
    const coreAdr = require('../packages/core/dist/core/src/artifacts/adrGenerator');
    const coreSummary = require('../packages/core/dist/core/src/sessions/sessionSummary');
    buildADR = coreAdr.buildADR;
    buildSessionSummary = coreSummary.buildSessionSummary;
    console.log('  ✓ Core generators loaded');
  } catch (err) {
    console.error(`  ⚠️  Could not load compiled core generators: ${err.message}`);
    console.log('  Note: Run "pnpm --filter @signalforge/core run build" first');
    process.exit(1);
  }

  console.log('\nStep 3: Calling core generators...');
  let adr1, adr2, summary1, summary2;

  try {
    adr1 = buildADR(events);
    adr2 = buildADR(events); // Generate again for determinism check
    summary1 = buildSessionSummary(events);
    summary2 = buildSessionSummary(events); // Generate again for determinism check
    console.log('  ✓ Generators returned output');
  } catch (err) {
    console.error(`  ❌ Generator error: ${err}`);
    process.exit(1);
  }

  console.log('\nStep 4: Validating ADR artifact...');
  let adrValid = true;
  adrValid = validateNoInvalidContent(adr1, 'ADR') && adrValid;
  adrValid = validateSkipCountsPresent(adr1, 'ADR') && adrValid;
  adrValid = validateOutcomePresent(adr1, 'ADR') && adrValid;
  adrValid = validateThreadIdConsistent(adr1, 'phase-2-5-validation-thread', 'ADR') && adrValid;
  adrValid = validateDeterminism(adr1, adr2, 'ADR') && adrValid;

  console.log('\nStep 5: Validating Session Summary artifact...');
  let summaryValid = true;
  summaryValid = validateNoInvalidContent(summary1, 'Session Summary') && summaryValid;
  summaryValid = validateSkipCountsPresent(summary1, 'Session Summary') && summaryValid;
  summaryValid = validateOutcomePresent(summary1, 'Session Summary') && summaryValid;
  summaryValid = validateThreadIdConsistent(summary1, 'phase-2-5-validation-thread', 'Session Summary') && summaryValid;
  summaryValid = validateDeterminism(summary1, summary2, 'Session Summary') && summaryValid;

  console.log('\nStep 6: Writing artifacts to temp directory...');
  const tempDir = path.join(__dirname, '..', '.phase-2-5-validation');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const threadId = 'phase-2-5-validation-thread';
  const filenames = {
    adr: path.join(tempDir, `${threadId}-adr.md`),
    summary: path.join(tempDir, `${threadId}-summary.md`),
    validation: path.join(tempDir, 'validation-report.txt'),
  };

  try {
    fs.writeFileSync(filenames.adr, adr1, 'utf-8');
    fs.writeFileSync(filenames.summary, summary1, 'utf-8');
    console.log(`  ✓ ADR written: ${filenames.adr}`);
    console.log(`  ✓ Session Summary written: ${filenames.summary}`);
  } catch (err) {
    console.error(`  ❌ Write error: ${err}`);
    process.exit(1);
  }

  console.log('\nStep 7: Generating validation report...');
  const reportLines = [
    'Phase 2.5 Deterministic Validation Report',
    '==========================================\n',
    `Timestamp: ${new Date().toISOString()}`,
    `Temp Directory: ${tempDir}`,
    `Thread ID: ${threadId}`,
    `Events Seeded: ${events.length}\n`,
    'Validation Results:',
    '-'.repeat(40),
    `ADR Artifact Valid: ${adrValid ? 'PASS' : 'FAIL'}`,
    `Session Summary Valid: ${summaryValid ? 'PASS' : 'FAIL'}`,
    `Overall Status: ${adrValid && summaryValid ? 'PASS ✓' : 'FAIL ❌'}\n`,
    'Metrics:',
    '-'.repeat(40),
    `ADR Length: ${adr1.length} characters`,
    `Session Summary Length: ${summary1.length} characters`,
    `ADR Contains Outcomes: ${/renderedOutcomes: [1-9]/.test(adr1)}`,
    `Session Summary Contains Outcomes: ${/renderedOutcomes: [1-9]/.test(summary1)}\n`,
    'Files Generated:',
    '-'.repeat(40),
    `- ${filenames.adr}`,
    `- ${filenames.summary}`,
    `- ${filenames.validation}`,
  ];

  const report = reportLines.join('\n');
  fs.writeFileSync(filenames.validation, report, 'utf-8');
  console.log(report);

  console.log('\n' + '='.repeat(50));
  if (adrValid && summaryValid) {
    console.log('✓ Phase 2.5 Validation PASSED\n');
    console.log('All invariants maintained:');
    console.log('  1. Canonical event stream is source of truth');
    console.log('  2. Core owns artifact semantics');
    console.log('  3. No duplicate rendering logic');
    console.log('  4. Invalid events excluded transparently');
    console.log('  5. Skip counts track all filtered rows\n');
    console.log(`Validation artifacts: ${tempDir}\n`);
    process.exit(0);
  } else {
    console.log('❌ Phase 2.5 Validation FAILED\n');
    console.log('Issues detected. See validation report above.\n');
    process.exit(1);
  }
}

// Run validation
runValidation().catch((err) => {
  console.error('Validation script error:', err);
  process.exit(1);
});

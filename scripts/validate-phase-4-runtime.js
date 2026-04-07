const fs = require('fs');
const path = require('path');

process.env.SIGNALFORGE_USE_INMEMORY_DB = '1';

const coreRoot = path.resolve(__dirname, '../packages/core/dist/core/src');
const { openDatabase } = require(path.join(coreRoot, 'storage/db'));
const { getChatEventsByThread } = require(path.join(coreRoot, 'repositories/chatEventRepository'));
const { getOutcomesByDispatch } = require(path.join(coreRoot, 'repositories/outcomeRepository'));
const { extractPatterns } = require(path.join(coreRoot, 'patterns/patternExtractor'));
const { generateInsights } = require(path.join(coreRoot, 'artifacts/insightsGenerator'));
const { generatePortfolioSignal } = require(path.join(coreRoot, 'artifacts/portfolioSignalGenerator'));
const { generateLinkedInTopics } = require(path.join(coreRoot, 'artifacts/linkedInTopicsUpgrade'));
const { generateSignalIndex } = require(path.join(coreRoot, 'signals/signalIndex'));

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseContent(content) {
  if (content && typeof content === 'object') return content;
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') return parsed;
      return { summary: String(content) };
    } catch {
      return { summary: String(content) };
    }
  }
  return { summary: '' };
}

function rowToForgeEvent(row, fallbackProjectId) {
  const content = parseContent(row.content);
  const summary = typeof content.summary === 'string' ? content.summary : JSON.stringify(content);
  return {
    event_id: row.event_id || `evt_${Math.random().toString(36).slice(2)}`,
    thread_id: row.chat_thread_id || row.thread_id || 'unknown-thread',
    project_id: row.project_id || fallbackProjectId,
    session_id: row.session_id || null,
    dispatch_id: row.dispatch_id || null,
    source: row.source || 'cli',
    role: row.role || 'user',
    event_type: row.event_type || 'chat_turn_completed',
    content: {
      summary,
      details: content.details || '',
      status: content.status,
      artifacts: content.artifacts,
    },
    timestamp: row.created_at || new Date(0).toISOString(),
  };
}

function validateFileContent(filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, reason: 'file missing' };
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content || !content.trim()) return { ok: false, reason: 'empty content' };

  const badTokens = ['undefined', '[object Object]'];
  for (const token of badTokens) {
    if (content.includes(token)) return { ok: false, reason: `contains token: ${token}` };
  }

  // strict null check requested
  if (content.includes('null')) return { ok: false, reason: 'contains token: null' };

  return { ok: true, reason: 'ok' };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function compareFiles(fileA, fileB) {
  const a = fs.readFileSync(fileA, 'utf8');
  const b = fs.readFileSync(fileB, 'utf8');
  return a === b;
}

function isOutcomeRow(row) {
  return !!row && typeof row === 'object' && (
    typeof row.outcome_id === 'string' ||
    typeof row.dispatch_thread_id === 'string' ||
    typeof row.what_changed === 'string' ||
    typeof row.what_broke === 'string'
  );
}

async function main() {
  const projectId = process.argv[2] || 'signalforge';
  const dbPath = path.resolve(__dirname, '../apps/native-host/data/signalforge.db');
  const db = openDatabase(dbPath);

  const allRows = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM chat_events ORDER BY created_at ASC', [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });

  if (!allRows.length) {
    console.error('FAIL: No stored chat events found in canonical storage.');
    process.exit(1);
  }

  const byThread = new Map();
  for (const r of allRows) {
    const tid = r.chat_thread_id || r.thread_id;
    if (!tid) continue;
    byThread.set(tid, (byThread.get(tid) || 0) + 1);
  }

  const realThreadId = [...byThread.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!realThreadId) {
    console.error('FAIL: Could not determine a real thread_id from storage.');
    process.exit(1);
  }

  const realRows = await getChatEventsByThread(db, realThreadId);
  const rawOutcomes = await getOutcomesByDispatch(db, realThreadId).catch(() => []);
  const outcomes = (Array.isArray(rawOutcomes) ? rawOutcomes : []).filter(isOutcomeRow);
  const events = realRows.map((r) => rowToForgeEvent(r, projectId));

  const baseDir = path.resolve(__dirname, `../docs/${projectId}/runtime-validation/${realThreadId}`);
  const run1Dir = path.join(baseDir, 'run-1');
  const run2Dir = path.join(baseDir, 'run-2');
  ensureDir(run1Dir);
  ensureDir(run2Dir);

  function runPipeline(runDir) {
    const patterns = extractPatterns(projectId, events, outcomes);
    const insights = generateInsights(projectId, events, patterns.patterns, outcomes);
    const portfolio = generatePortfolioSignal(projectId, events, patterns.patterns, outcomes);
    const topics = generateLinkedInTopics(projectId, events, patterns.patterns);
    const index = generateSignalIndex(projectId, events, outcomes, patterns.patterns);

    const files = {
      patterns: path.join(runDir, 'patterns.json'),
      insights: path.join(runDir, 'insights.json'),
      portfolio: path.join(runDir, 'portfolio-signal.json'),
      topics: path.join(runDir, 'linkedin-topics.json'),
      index: path.join(runDir, 'signal-index.json'),
    };

    writeJson(files.patterns, patterns);
    writeJson(files.insights, insights);
    writeJson(files.portfolio, portfolio);
    writeJson(files.topics, topics);
    writeJson(files.index, index);

    return { patterns, insights, portfolio, topics, index, files };
  }

  const r1 = runPipeline(run1Dir);
  const r2 = runPipeline(run2Dir);

  const checks = [];
  for (const key of Object.keys(r1.files)) {
    const p1 = r1.files[key];
    const p2 = r2.files[key];

    const c1 = validateFileContent(p1);
    const c2 = validateFileContent(p2);
    checks.push({ type: 'content', file: p1, ok: c1.ok, reason: c1.reason });
    checks.push({ type: 'content', file: p2, ok: c2.ok, reason: c2.reason });

    const same = compareFiles(p1, p2);
    checks.push({ type: 'determinism', file: `${key}`, ok: same, reason: same ? 'identical' : 'different bytes' });
  }

  console.log('\nPhase 4 Runtime Validation (Real Storage)');
  console.log('-----------------------------------------');
  console.log(`project_id: ${projectId}`);
  console.log(`thread_id: ${realThreadId}`);
  console.log(`events_loaded: ${events.length}`);
  console.log(`outcomes_loaded: ${outcomes.length}`);
  console.log(`patterns_count: ${r1.patterns.patterns?.length || 0}`);
  console.log(`signals_count: ${r1.index.signals?.length || 0}`);
  console.log(`topics_count: ${r1.topics.topics?.length || 0}`);
  console.log('');

  console.log('Output files:');
  Object.values(r1.files).forEach((f) => console.log(`- ${f}`));
  Object.values(r2.files).forEach((f) => console.log(`- ${f}`));

  console.log('\nValidation checks:');
  let failed = 0;
  for (const chk of checks) {
    const label = chk.ok ? 'OK' : 'FAIL';
    console.log(`${label} | ${chk.type} | ${chk.file} | ${chk.reason}`);
    if (!chk.ok) failed++;
  }

  console.log('');
  if (failed === 0) {
    console.log('SUCCESS: All runtime validation checks passed.');
    process.exit(0);
  }

  console.log(`FAILURE: ${failed} checks failed.`);
  process.exit(1);
}

main().catch((err) => {
  console.error('FAILURE: Runtime validation crashed:', err);
  process.exit(1);
});

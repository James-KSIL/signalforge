const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const jsonPath = path.resolve('apps', 'native-host', 'data', 'signalforge.json');
if (!fs.existsSync(jsonPath)) {
  console.error('No in-memory DB file found at', jsonPath);
  process.exit(1);
}
const raw = fs.readFileSync(jsonPath, 'utf8');
const obj = JSON.parse(raw || '{}');
const events = obj.chat_events || [];
const threadId = process.argv[2] || (events[0] && events[0].chat_thread_id) || 'unknown_thread';

const lines = [];
lines.push('# Dispatch: ' + threadId);
lines.push('');
lines.push('## Captured Events');
lines.push('');
events.forEach((e, i) => {
  if (e.chat_thread_id !== threadId) return;
  lines.push(`### Event ${i + 1} — ${e.event_type} (${e.created_at})`);
  lines.push('');
  lines.push(`- role: ${e.role}`);
  lines.push(`- content: ${e.content}`);
  if (e.source_url) lines.push(`- source: ${e.source_url}`);
  lines.push('');
});

const promptLines = [];
promptLines.push('# Prompt for ' + threadId);
promptLines.push('');
const userMsgs = events.filter(x => x.chat_thread_id === threadId && (x.role === 'user' || x.role === 'assistant'));
userMsgs.forEach(m => {
  promptLines.push('> ' + m.content);
  promptLines.push('');
});

const copilot = [];
copilot.push('You are Copilot. Materialize the following dispatch into repository files.');
copilot.push('Follow SIGNALFORGE contract conventions.');
copilot.push('');
copilot.push('Dispatch summary:');
copilot.push('');
copilot.push(events.filter(e => e.chat_thread_id === threadId).map(e => '- ' + e.event_type + ': ' + String(e.content).slice(0,120)).join('\n'));

// Extract project_id from events (Phase 3: project-scoped routing)
const threadEvents = events.filter(e => e.chat_thread_id === threadId);
const projectId = (threadEvents[0] && threadEvents[0].project_id) || 'default-project';

// Route to project-scoped paths (canonical layout post-Phase 3)
const contractDir = path.resolve('docs', projectId, 'contracts');
const promptsDir = path.resolve('docs', projectId, 'prompts');
const copilotDir = path.resolve('.github');
ensureDir(contractDir);
ensureDir(promptsDir);
ensureDir(copilotDir);

const contractPath = path.join(contractDir, `${threadId}.md`);
const promptPath = path.join(promptsDir, `${threadId}.md`);
const copilotPath = path.join(copilotDir, 'copilot-instructions.md');

fs.writeFileSync(contractPath, lines.join('\n'));
fs.writeFileSync(promptPath, promptLines.join('\n'));
fs.writeFileSync(copilotPath, copilot.join('\n'));

console.log('WROTE (project-scoped)', { projectId, contractPath, promptPath, copilotPath });

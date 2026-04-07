const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// This test will spawn the native host via the package dev script (ts-node). Ensure you've run `pnpm install`.

// spawn the native host using ts-node register so runtime path mappings resolve
const child = spawn(process.execPath, ['-r', 'tsconfig-paths/register', '-r', 'ts-node/register', 'src/main.ts'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'inherit']
});

function writeFramed(obj) {
  const s = JSON.stringify(obj);
  const b = Buffer.from(s, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(b.length, 0);
  child.stdin.write(Buffer.concat([header, b]));
}

child.stdout.on('data', (d) => {
  // framed response: skip 4-byte length if present
  try {
    if (d.length > 4) d = d.slice(4);
    const resp = JSON.parse(d.toString('utf8'));
    console.log('ack:', resp);
  } catch (err) {
    console.log('raw resp:', d.toString('utf8'));
  }
});

const testEvent = {
  kind: 'browser_event',
  payload: {
    type: 'chat_turn_completed',
    eventId: 'test_evt_1',
    chatThreadId: 'test_thread',
    sourceUrl: 'https://chat.openai.com/',
    turnIndex: 1,
    role: 'user',
    content: 'this is a test generate handoff',
    createdAt: new Date().toISOString()
  }
};

writeFramed(testEvent);

setTimeout(() => {
  // send duplicate to test idempotency
  writeFramed(testEvent);
}, 300);

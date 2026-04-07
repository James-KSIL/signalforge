import { startStdinTransport } from './stdinTransport';
import { writeResponse } from './stdoutTransport';
import { closeNativeHostDatabase, drainBootstrapAuthoritySignal, getBootstrapSignalFilePath, getBootstrapSignalDbPath, handleInbound } from './services/ingestService';

function isTestContext(): boolean {
  if (process.env.NODE_TEST_CONTEXT === '1') return true;
  if (typeof process.env.NODE_TEST_CONTEXT === 'string' && process.env.NODE_TEST_CONTEXT.trim()) return true;
  if (typeof process.env.NODE_UNIQUE_ID !== 'undefined') return true;

  const execArgv = Array.isArray(process.execArgv) ? process.execArgv : [];
  return execArgv.some((arg) => String(arg || '').includes('--test'));
}

function enforceContentHashOverrideGuard(): void {
  const overrideEnabled = process.env.SIGNALFORGE_ALLOW_CONTENT_HASH_OVERRIDE === '1';
  const inTestContext = isTestContext();

  if (overrideEnabled && !inTestContext) {
    process.env.SIGNALFORGE_ALLOW_CONTENT_HASH_OVERRIDE = '0';

    console.error(
      '[SignalForge][SECURITY][CONTENT_HASH_OVERRIDE_DISABLED] SIGNALFORGE_ALLOW_CONTENT_HASH_OVERRIDE was set outside test context.\n'
      + 'This flag is restricted to test runner execution only.\n'
      + 'Override has been force-disabled for this process.',
      {
        pid: process.pid,
        execPath: process.execPath,
        nodeTestContext: process.env.NODE_TEST_CONTEXT || null,
        nodeUniqueId: process.env.NODE_UNIQUE_ID || null,
        execArgv: process.execArgv,
      }
    );
  }
}

enforceContentHashOverrideGuard();

// Native messaging protocol requires stdout to contain only framed JSON responses.
// Route informational logs to stderr so Chrome does not treat logs as protocol corruption.
console.log = (...args: any[]) => {
  console.error(...args);
};

let inFlightMessages = 0;
let stdinEnded = false;

function maybeShutdownAfterStdinEnd(): void {
  if (stdinEnded && inFlightMessages === 0) {
    void shutdownAndExit(0);
  }
}

startStdinTransport((message) => {
  inFlightMessages += 1;
  void handleInbound(message)
    .then((response) => writeResponse(response))
    .catch((error) => writeResponse({ type: 'error', message_id: 'msg_unknown', reason: String(error) }))
    .finally(() => {
      inFlightMessages = Math.max(0, inFlightMessages - 1);
      maybeShutdownAfterStdinEnd();
    });
}, (error) => {
  writeResponse({ type: 'error', message_id: 'msg_unknown', reason: String(error) });
});

// Push-first bootstrap authority propagation:
// drain event signal and emit to connected Chrome background immediately.
console.error('[SignalForge] bootstrap authority poller started', {
  interval_ms: 500,
  signal_file: getBootstrapSignalFilePath(),
});
console.error('[SignalForge:path] startup', {
  process: 'native-host',
  db_path: getBootstrapSignalDbPath(),
  signal_file: getBootstrapSignalFilePath(),
});

// Track last sent authority to avoid duplicate sends on every poll tick
let lastSentAuthority: { project_id: string; timestamp: string } | null = null;

const bootstrapSignalInterval = setInterval(() => {
  const event = drainBootstrapAuthoritySignal();
  if (event) {
    const eventData = event as any;
    const normalizedProjectId = typeof eventData?.project_id === 'string'
      ? eventData.project_id.trim()
      : '';
    // Hard gate: poller can only emit bootstrap authority with a real project_id.
    if (
      eventData?.type !== 'bootstrap_authority' ||
      typeof eventData?.project_id !== 'string' ||
      normalizedProjectId.length === 0 ||
      normalizedProjectId.toLowerCase() === 'null' ||
      normalizedProjectId.toLowerCase() === 'undefined'
    ) {
      return;
    }

    // Only send if this is a new/different authority (avoid sending same authority on every poll tick)
    const isNewAuthority = !lastSentAuthority ||
      lastSentAuthority.project_id !== eventData.project_id ||
      lastSentAuthority.timestamp !== eventData.timestamp;

    if (isNewAuthority) {
      console.error('[SignalForge] bootstrap authority forwarded to chrome via push', { 
        project_id: normalizedProjectId,
        source: eventData.source || 'signal_file_poll' 
      });
      writeResponse(event);
      console.error('[SignalForge] bootstrap authority writeResponse completed', { 
        project_id: normalizedProjectId,
        source: eventData.source || 'signal_file_poll' 
      });
      // Track that we sent this authority
      lastSentAuthority = {
        project_id: normalizedProjectId,
        timestamp: eventData.timestamp,
      };
    }
  }
}, 500);

let shuttingDown = false;
async function shutdownAndExit(code: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(bootstrapSignalInterval);
  await closeNativeHostDatabase();

  // Avoid hard process termination on normal stdin-end path so framed
  // stdout responses can flush before the process exits.
  process.exitCode = code;
  process.stdin.pause();

  if (code !== 0) {
    process.exit(code);
  }
}

process.on('SIGINT', () => {
  void shutdownAndExit(0);
});

process.on('SIGTERM', () => {
  void shutdownAndExit(0);
});

// graceful keepalive
process.stdin.on('end', () => {
  stdinEnded = true;
  maybeShutdownAfterStdinEnd();
});

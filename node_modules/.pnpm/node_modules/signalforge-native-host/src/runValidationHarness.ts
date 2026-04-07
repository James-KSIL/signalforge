import { runCopilotValidationHarness } from './services/validationHarness';

const summary = runCopilotValidationHarness();

console.log('[SignalForge] Copilot validation harness results');
console.log(JSON.stringify(summary, null, 2));

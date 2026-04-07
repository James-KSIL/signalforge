"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validationHarness_1 = require("./services/validationHarness");
const summary = (0, validationHarness_1.runCopilotValidationHarness)();
console.log('[SignalForge] Copilot validation harness results');
console.log(JSON.stringify(summary, null, 2));

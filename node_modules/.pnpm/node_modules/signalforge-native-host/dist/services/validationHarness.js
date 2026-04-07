"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCopilotValidationHarness = void 0;
const validationHarness_1 = require("@signalforge/core/dist/validation/validationHarness");
function runCopilotValidationHarness() {
    return (0, validationHarness_1.runValidationHarness)();
}
exports.runCopilotValidationHarness = runCopilotValidationHarness;

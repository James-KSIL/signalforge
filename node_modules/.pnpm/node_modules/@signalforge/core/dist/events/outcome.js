"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOutcomeEvent = void 0;
const helpers_1 = require("./helpers");
function buildOutcomeEvent(thread_id, input) {
    const details = [`WHAT CHANGED:`, input.whatChanged, '', `RESISTANCE:`, input.resistance ?? 'none', '', `NEXT STEP:`, input.nextStep].join('\n');
    const content = {
        summary: input.title,
        status: input.status,
        details: details.trim(),
    };
    return (0, helpers_1.createEvent)({
        thread_id,
        project_id: input.projectId,
        session_id: input.sessionId,
        dispatch_id: input.dispatchId,
        source: input.source,
        role: 'outcome',
        event_type: 'outcome_logged',
        content,
    });
}
exports.buildOutcomeEvent = buildOutcomeEvent;

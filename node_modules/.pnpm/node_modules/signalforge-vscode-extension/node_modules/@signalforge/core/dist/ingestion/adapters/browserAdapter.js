"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserAdapter = void 0;
const helpers_1 = require("../../events/helpers");
function normalizeContent(input) {
    if (typeof input.content === 'string') {
        const text = input.content.trim();
        return { summary: text || '[empty summary]' };
    }
    const contentObj = input.content;
    const normalized = {
        ...contentObj,
    };
    const artifactRefs = input.artifact_refs ?? contentObj.artifact_refs;
    if (artifactRefs !== undefined) {
        normalized.artifact_refs = artifactRefs;
    }
    return normalized;
}
// Browser ingestion is intentionally a controlled stub in Phase 3.
function browserAdapter(input) {
    const event = (0, helpers_1.createEvent)({
        thread_id: input.thread_id,
        project_id: input.project_id,
        session_id: input.session_id,
        dispatch_id: input.dispatch_id,
        source: 'browser',
        role: input.role,
        event_type: input.event_type,
        content: normalizeContent(input),
    });
    return { event, source: 'browser' };
}
exports.browserAdapter = browserAdapter;

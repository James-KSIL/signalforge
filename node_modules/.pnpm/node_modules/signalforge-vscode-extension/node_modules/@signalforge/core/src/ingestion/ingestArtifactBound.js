"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestArtifactBound = void 0;
const chatEventRepository_1 = require("../repositories/chatEventRepository");
const helpers_1 = require("../events/helpers");
function normalizeCopiedText(copiedText) {
    return String(copiedText || '').trim();
}
async function ingestArtifactBound(db, payload) {
    const copiedText = normalizeCopiedText(payload.copied_text);
    if (!payload.chat_id || !String(payload.chat_id).trim())
        throw new Error('artifact_bound requires chat_id');
    if (!payload.project_id || !String(payload.project_id).trim())
        throw new Error('artifact_bound requires project_id');
    if (!payload.authority || !String(payload.authority).trim())
        throw new Error('artifact_bound requires authority');
    if (!copiedText)
        throw new Error('artifact_bound requires non-empty copied_text');
    if (!payload.created_at || !String(payload.created_at).trim())
        throw new Error('artifact_bound requires created_at');
    const event = (0, helpers_1.createEvent)({
        thread_id: payload.chat_id,
        project_id: payload.project_id,
        source: 'browser',
        role: 'observer',
        event_type: 'artifact_bound',
        content: {
            summary: 'Bound ChatGPT artifact',
            details: JSON.stringify({
                chat_id: payload.chat_id,
                project_id: payload.project_id,
                authority: payload.authority,
                selection_type: payload.selection_type,
                source_url: payload.source_url,
                created_at: payload.created_at,
                copied_text,
            }, null, 2),
            metadata: {
                authority: payload.authority,
                selection_type: payload.selection_type,
                source_url: payload.source_url,
                ready_for_materialization: true,
            },
        },
    });
    await (0, chatEventRepository_1.insertChatEvent)(db, {
        chat_thread_id: event.thread_id,
        project_id: event.project_id,
        session_id: event.session_id,
        dispatch_id: event.dispatch_id,
        source: event.source,
        turn_index: 0,
        role: event.role,
        event_type: event.event_type,
        content: JSON.stringify(event.content),
        artifact_refs: event.content.artifact_refs ? JSON.stringify(event.content.artifact_refs) : null,
        source_url: payload.source_url,
        matched_trigger: null,
        created_at: event.timestamp,
    });
}
exports.ingestArtifactBound = ingestArtifactBound;

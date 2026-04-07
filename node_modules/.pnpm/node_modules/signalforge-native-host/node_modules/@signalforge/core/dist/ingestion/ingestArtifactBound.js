"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestArtifactBound = void 0;
const chatEventRepository_1 = require("../repositories/chatEventRepository");
const helpers_1 = require("../events/helpers");
function normalizeCopiedText(copiedText) {
    return String(copiedText || '').trim();
}
function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function computeTextHash(text) {
    const normalized = normalizeText(text);
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i += 1) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `fnv1a_${(hash >>> 0).toString(16)}`;
}
function containsAny(text, needles) {
    const lower = normalizeText(text);
    return needles.some((needle) => lower.includes(needle));
}
async function ingestArtifactBound(db, payload) {
    const payloadContext = payload;
    console.log('[SignalForge] artifact_bound triggered at entry', {
        chat_id: payload.chat_id,
        project_id: payload.project_id,
        session_id: payloadContext.session_id || null,
        dispatch_id: payloadContext.dispatch_id || null,
        authority: payload.authority,
        selection_type: payload.selection_type,
        copied_text_length: String(payload.copied_text || '').length,
    });
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
        session_id: payloadContext.session_id ? String(payloadContext.session_id) : undefined,
        dispatch_id: payloadContext.dispatch_id ? String(payloadContext.dispatch_id) : undefined,
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
                copied_text: copiedText,
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

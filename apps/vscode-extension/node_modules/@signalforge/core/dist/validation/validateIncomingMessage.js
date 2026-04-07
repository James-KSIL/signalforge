"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInbound = void 0;
const ALLOWED_AUTHORITIES = ['pinned_project', 'active_workspace', 'recent_project', 'manual_selection'];
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function validateCopyBindingPayload(payload) {
    if (!isNonEmptyString(payload.chat_id))
        return { ok: false, error: 'missing chat_id' };
    if (!isNonEmptyString(payload.copied_text))
        return { ok: false, error: 'missing copied_text' };
    if (!isNonEmptyString(payload.selection_type))
        return { ok: false, error: 'missing selection_type' };
    if (!isNonEmptyString(payload.source_url))
        return { ok: false, error: 'missing source_url' };
    if (!isNonEmptyString(payload.created_at))
        return { ok: false, error: 'missing created_at' };
    return { ok: true };
}
function validateArtifactBoundPayload(payload) {
    const base = validateCopyBindingPayload(payload);
    if (!base.ok)
        return base;
    if (!isNonEmptyString(payload.project_id))
        return { ok: false, error: 'missing project_id' };
    if (!isNonEmptyString(payload.authority))
        return { ok: false, error: 'missing authority' };
    if (!ALLOWED_AUTHORITIES.includes(payload.authority))
        return { ok: false, error: 'invalid authority' };
    return { ok: true };
}
function validateBrowserEventPayload(payload) {
    if (!payload || typeof payload !== 'object')
        return { ok: false, error: 'missing payload' };
    switch (payload.type) {
        case 'chat_turn_completed':
            if (!isNonEmptyString(payload.eventId))
                return { ok: false, error: 'missing eventId' };
            if (!isNonEmptyString(payload.chatThreadId))
                return { ok: false, error: 'missing chatThreadId' };
            if (!isNonEmptyString(payload.content))
                return { ok: false, error: 'missing content' };
            return { ok: true };
        case 'dispatch_phrase_detected':
            if (!isNonEmptyString(payload.eventId))
                return { ok: false, error: 'missing eventId' };
            if (!isNonEmptyString(payload.chatThreadId))
                return { ok: false, error: 'missing chatThreadId' };
            if (!isNonEmptyString(payload.content))
                return { ok: false, error: 'missing content' };
            if (!isNonEmptyString(payload.matchedTrigger))
                return { ok: false, error: 'missing matchedTrigger' };
            return { ok: true };
        case 'dispatch_candidate_created':
            if (!isNonEmptyString(payload.eventId))
                return { ok: false, error: 'missing eventId' };
            if (!isNonEmptyString(payload.chatThreadId))
                return { ok: false, error: 'missing chatThreadId' };
            if (!isNonEmptyString(payload.content))
                return { ok: false, error: 'missing content' };
            return { ok: true };
        case 'copilot_candidate_captured':
            if (!isNonEmptyString(payload.candidate_id))
                return { ok: false, error: 'missing candidate_id' };
            if (!isNonEmptyString(payload.project_id))
                return { ok: false, error: 'missing project_id' };
            if (!isNonEmptyString(payload.session_id))
                return { ok: false, error: 'missing session_id' };
            if (!isNonEmptyString(payload.captured_at))
                return { ok: false, error: 'missing captured_at' };
            if (!isNonEmptyString(payload.raw_text))
                return { ok: false, error: 'missing raw_text' };
            if (!payload.signal_flags || typeof payload.signal_flags !== 'object') {
                return { ok: false, error: 'missing signal_flags' };
            }
            return { ok: true };
        case 'chatgpt_turn_classified':
            if (!isNonEmptyString(payload.eventId))
                return { ok: false, error: 'missing eventId' };
            if (!isNonEmptyString(payload.chatThreadId))
                return { ok: false, error: 'missing chatThreadId' };
            if (!isNonEmptyString(payload.content))
                return { ok: false, error: 'missing content' };
            if (!isNonEmptyString(payload.classification))
                return { ok: false, error: 'missing classification' };
            if (!Array.isArray(payload.classification_signals))
                return { ok: false, error: 'missing classification_signals' };
            if (!isNonEmptyString(payload.timestamp))
                return { ok: false, error: 'missing timestamp' };
            return { ok: true };
        case 'copilot_candidate_lookup_query':
            if (!isNonEmptyString(payload.project_id))
                return { ok: false, error: 'missing project_id' };
            if (!isNonEmptyString(payload.text_hash))
                return { ok: false, error: 'missing text_hash' };
            if (typeof payload.normalized_length !== 'number' || payload.normalized_length <= 0) {
                return { ok: false, error: 'missing normalized_length' };
            }
            if (!isNonEmptyString(payload.excerpt))
                return { ok: false, error: 'missing excerpt' };
            if (!isNonEmptyString(payload.captured_at))
                return { ok: false, error: 'missing captured_at' };
            return { ok: true };
        case 'copy_binding_requested':
            return validateCopyBindingPayload(payload);
        case 'artifact_bound':
            return validateArtifactBoundPayload(payload);
        default:
            return { ok: true };
    }
}
function validateInbound(obj) {
    if (!obj || typeof obj !== 'object')
        return { ok: false, error: 'not an object' };
    if (obj.kind !== 'browser_event')
        return { ok: false, error: 'unsupported kind' };
    return validateBrowserEventPayload(obj.payload);
}
exports.validateInbound = validateInbound;

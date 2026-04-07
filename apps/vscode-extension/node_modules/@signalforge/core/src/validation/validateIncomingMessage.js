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
        case 'copy_binding_requested':
            return validateCopyBindingPayload(payload);
        case 'artifact_bound':
            return validateArtifactBoundPayload(payload);
        default:
            return { ok: false, error: `unsupported payload type: ${String(payload.type || 'unknown')}` };
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

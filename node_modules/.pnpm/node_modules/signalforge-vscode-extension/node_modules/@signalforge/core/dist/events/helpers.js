"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEvent = exports.assertValidEvent = exports.safeRole = exports.normalizeRole = exports.toDispatchId = exports.generateId = exports.isAllowedEventRole = exports.ALLOWED_EVENT_ROLES = void 0;
exports.ALLOWED_EVENT_ROLES = ['system', 'user', 'assistant', 'worker', 'observer', 'outcome'];
function isAllowedEventRole(role) {
    return !!role && exports.ALLOWED_EVENT_ROLES.includes(role);
}
exports.isAllowedEventRole = isAllowedEventRole;
function generateId() {
    return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
exports.generateId = generateId;
function toDispatchId(dispatchThreadId) {
    if (!dispatchThreadId)
        return undefined;
    const normalized = String(dispatchThreadId).trim();
    if (!normalized)
        return undefined;
    return `dsp_${normalized}`;
}
exports.toDispatchId = toDispatchId;
function normalizeRole(role) {
    return isAllowedEventRole(role) ? role : 'system';
}
exports.normalizeRole = normalizeRole;
// Read-side safe role normalizer
function safeRole(role) {
    return isAllowedEventRole(role) ? role : 'system';
}
exports.safeRole = safeRole;
function hasUndefinedValues(value) {
    if (value === undefined)
        return true;
    if (Array.isArray(value))
        return value.some((item) => hasUndefinedValues(item));
    if (value && typeof value === 'object') {
        return Object.values(value).some((item) => hasUndefinedValues(item));
    }
    return false;
}
// Read-side assertion to ensure events are valid before transformation
function assertValidEvent(e) {
    if (!e.thread_id) {
        throw new Error('Invalid event: missing thread_id');
    }
    if (!e.project_id) {
        throw new Error('Invalid event: missing project_id');
    }
    if (!e.source) {
        throw new Error('Invalid event: missing source');
    }
    if (!e.content || !e.content.summary) {
        throw new Error('Invalid event: missing content.summary');
    }
    // At this point, cast is safe for downstream consumers
    return e;
}
exports.assertValidEvent = assertValidEvent;
function createEvent(input) {
    if (!input.role || !isAllowedEventRole(input.role)) {
        throw new Error(`Event role must be one of: ${exports.ALLOWED_EVENT_ROLES.join(', ')}`);
    }
    if (!input.event_type || typeof input.event_type !== 'string') {
        throw new Error('Event must include event_type');
    }
    if (!input.content || typeof input.content.summary !== 'string' || !input.content.summary.trim()) {
        throw new Error('Event must include summary');
    }
    if (!input.thread_id) {
        throw new Error('Event must include thread_id');
    }
    if (!input.project_id || typeof input.project_id !== 'string' || !input.project_id.trim()) {
        throw new Error('Event must include non-null project_id');
    }
    const allowedSources = ['vscode', 'browser', 'cli'];
    if (!input.source || !allowedSources.includes(input.source)) {
        throw new Error(`Event source must be one of: ${allowedSources.join(', ')}`);
    }
    if (input.dispatch_id !== undefined && (typeof input.dispatch_id !== 'string' || !input.dispatch_id.trim())) {
        throw new Error('dispatch_id must be a non-empty string when provided');
    }
    if (input.content?.artifact_refs !== undefined) {
        if (!Array.isArray(input.content.artifact_refs) || input.content.artifact_refs.some((x) => typeof x !== 'string' || !x.trim())) {
            throw new Error('artifact_refs must be an array of non-empty strings when provided');
        }
    }
    if (hasUndefinedValues(input.content)) {
        throw new Error('Event content cannot include undefined values');
    }
    return {
        event_id: generateId(),
        thread_id: input.thread_id,
        project_id: input.project_id,
        session_id: input.session_id,
        dispatch_id: input.dispatch_id,
        source: input.source,
        role: input.role,
        event_type: input.event_type,
        content: input.content,
        timestamp: new Date().toISOString(),
    };
}
exports.createEvent = createEvent;

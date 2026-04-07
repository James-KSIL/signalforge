"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSessionSummary = void 0;
const helpers_1 = require("../events/helpers");
const outcomeNormalization_1 = require("../artifacts/outcomeNormalization");
function buildSessionSummary(events, options) {
    let skippedLegacyOrInvalid = 0;
    const validEvents = events.filter((e) => {
        const ok = !!e
            && (0, helpers_1.isAllowedEventRole)(e.role)
            && !!e.content
            && typeof e.content.summary === 'string'
            && !!e.content.summary.trim();
        if (!ok)
            skippedLegacyOrInvalid += 1;
        return ok;
    });
    const highlights = validEvents.map(e => {
        const status = typeof e.content.status === 'string' && e.content.status ? e.content.status : 'info';
        const summary = e.content.summary;
        return `- [${status}] (${e.role}) ${summary}`;
    });
    const outcomeRows = events.filter((e) => e && e.role === 'outcome');
    let skippedInvalidOutcomes = 0;
    const renderableOutcomes = outcomeRows.map((e) => {
        const normalized = (0, outcomeNormalization_1.normalizeOutcome)({
            ...(e && e.content ? e.content : {}),
            status: e?.content?.status,
            created_at: e?.timestamp || e?.created_at,
        });
        if (!normalized) {
            skippedInvalidOutcomes += 1;
            return null;
        }
        return normalized;
    }).filter((o) => !!o);
    const outcomeLines = renderableOutcomes.map((o) => `- [${o.status}] ${o.summary} (${o.created_at})`);
    const projectId = validEvents[0]?.project_id ?? 'unknown-project';
    const sessionId = validEvents[0]?.session_id ?? validEvents[0]?.thread_id ?? 'unknown-thread';
    const dispatchId = validEvents.find((e) => !!e.dispatch_id)?.dispatch_id ?? 'none';
    const traceLines = validEvents
        .slice(0, 12)
        .map((e) => `- ${e.timestamp} | ${e.source} | ${e.event_type} | ${e.content.summary}`);
    return [
        `Session Summary for ${validEvents[0]?.thread_id ?? 'unknown-thread'}`,
        '',
        'Project Context',
        '',
        `- project_id: ${projectId}`,
        `- session_id: ${sessionId}`,
        `- dispatch_id: ${dispatchId}`,
        '',
        `Skipped Legacy/Invalid Events: ${skippedLegacyOrInvalid}`,
        '',
        'Highlights',
        '',
        ...highlights,
        '',
        'Outcome Summary',
        '',
        `- totalOutcomes: ${outcomeRows.length}`,
        `- renderedOutcomes: ${renderableOutcomes.length}`,
        `- Skipped Legacy/Invalid Outcomes: ${skippedInvalidOutcomes}`,
        '',
        ...(outcomeLines.length ? outcomeLines : ['- none']),
        ...(options?.includeEventTrace
            ? [
                '',
                'Event Trace (compact)',
                '',
                ...(traceLines.length ? traceLines : ['- none']),
            ]
            : []),
    ].join('\n');
}
exports.buildSessionSummary = buildSessionSummary;

"use strict";
/**
 * Signal Index Generator
 *
 * Creates a lightweight machine-readable JSON index of major decisions and outcomes
 * for a project. Serves as the substrate for later analysis and Blacksmith work.
 *
 * Output: docs/<project_id>/signal/signal-index.json
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeSignalIndex = exports.serializeSignalIndex = exports.generateSignalIndex = void 0;
/**
 * Generate signal index from events, outcomes, and patterns
 */
function generateSignalIndex(projectId, events, outcomes = [], patterns = [], timeRangeStart, timeRangeEnd) {
    // Sort events by timestamp
    const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const deterministicTimestamp = getDeterministicTimestamp(sortedEvents, outcomes);
    // Get time range
    const start = timeRangeStart || (sortedEvents[0]?.timestamp) || deterministicTimestamp;
    const end = timeRangeEnd || (sortedEvents[sortedEvents.length - 1]?.timestamp) || deterministicTimestamp;
    // Build signal entries
    const signals = buildSignalEntries(projectId, events, outcomes, patterns, end);
    // Compute summaries
    const byType = {};
    const byStatus = {};
    const allTags = new Set();
    const tagFrequency = {};
    for (const signal of signals) {
        byType[signal.type] = (byType[signal.type] ?? 0) + 1;
        if (signal.status) {
            byStatus[signal.status] = (byStatus[signal.status] ?? 0) + 1;
        }
        signal.tags.forEach((tag) => {
            allTags.add(tag);
            tagFrequency[tag] = (tagFrequency[tag] ?? 0) + 1;
        });
    }
    const sessions = new Set(signals
        .map((signal) => signal.session_id)
        .filter((sessionId) => typeof sessionId === 'string' && sessionId.length > 0));
    const dispatches = new Set(signals
        .map((signal) => signal.dispatch_id)
        .filter((dispatchId) => typeof dispatchId === 'string' && dispatchId.length > 0));
    // Pattern statistics
    const patternsByCategory = {};
    const highestSeverity = [];
    for (const pattern of patterns) {
        const category = pattern.type || 'unknown';
        patternsByCategory[category] = (patternsByCategory[category] ?? 0) + 1;
        if (pattern.type === 'failure-mode') {
            highestSeverity.push({
                pattern_id: pattern.pattern_id,
                name: pattern.name,
                severity: pattern.severity,
            });
        }
    }
    highestSeverity.sort((a, b) => {
        const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
        return (severityRank[b.severity] ?? 0) -
            (severityRank[a.severity] ?? 0);
    });
    return {
        version: '1.0.0',
        generated_at: end,
        project_id: projectId,
        time_range: { start, end },
        summary: {
            total_signals: signals.length,
            by_type: byType,
            by_status: byStatus,
            unique_sessions: sessions.size,
            unique_dispatches: dispatches.size,
        },
        signals,
        patterns: {
            total_detected: patterns.length,
            by_category: patternsByCategory,
            highest_severity_patterns: highestSeverity.slice(0, 5),
        },
        tags: {
            all_tags: Array.from(allTags).sort(),
            tag_frequency: tagFrequency,
        },
        metadata: {
            deterministic: true,
            source: 'canonical-event-stream',
            validated: true,
        },
        dispatch_ids: Array.from(dispatches).sort(),
        session_ids: Array.from(sessions).sort(),
        outcome_summaries: outcomes
            .map((outcome) => String(outcome?.title || outcome?.what_changed || '').trim())
            .filter((text) => text.length > 0),
        artifact_references: signals
            .map((signal) => signal.artifact_path)
            .filter((artifactPath) => typeof artifactPath === 'string' && artifactPath.length > 0),
        recurring_tags: Object.keys(tagFrequency).sort((a, b) => (tagFrequency[b] ?? 0) - (tagFrequency[a] ?? 0)),
        pattern_ids: patterns.map((pattern) => pattern.pattern_id),
        output_path: `docs/${projectId}/signal/signal-index.json`,
        signal_index_path: `docs/${projectId}/signal/signal-index.json`,
        insights_path: `docs/${projectId}/insights/`,
        portfolio_path: `docs/${projectId}/portfolio/`,
    };
}
exports.generateSignalIndex = generateSignalIndex;
/**
 * Build signal entries from events and outcomes
 */
function buildSignalEntries(projectId, events, outcomes, patterns, fallbackTimestamp) {
    const signals = [];
    const seen = new Set();
    // Add dispatch signals
    const dispatchEvents = events.filter((e) => e.dispatch_id && e.event_type.includes('dispatch'));
    for (const event of dispatchEvents) {
        if (!seen.has(`dispatch_${event.dispatch_id}`)) {
            signals.push({
                id: `dispatch_${event.dispatch_id}`,
                type: 'dispatch',
                title: `Dispatch ${event.dispatch_id}`,
                summary: event.content.summary,
                timestamp: event.timestamp,
                project_id: projectId,
                dispatch_id: event.dispatch_id,
                session_id: event.session_id,
                status: event.content.status || 'active',
                tags: extractTagsFromEvent(event),
                pattern_ids: findPatternsForEvent(event, patterns),
            });
            seen.add(`dispatch_${event.dispatch_id}`);
        }
    }
    // Add session signals
    const sessionEvents = events.filter((e) => e.session_id && e.event_type.includes('session'));
    for (const event of sessionEvents) {
        if (!seen.has(`session_${event.session_id}`)) {
            signals.push({
                id: `session_${event.session_id}`,
                type: 'session',
                title: `Session ${event.session_id}`,
                summary: event.content.summary,
                timestamp: event.timestamp,
                project_id: projectId,
                session_id: event.session_id,
                status: event.event_type === 'session_ended'
                    ? 'closed'
                    : event.content.status || 'active',
                tags: extractTagsFromEvent(event),
                pattern_ids: findPatternsForEvent(event, patterns),
            });
            seen.add(`session_${event.session_id}`);
        }
    }
    // Add outcome signals
    for (let i = 0; i < outcomes.length; i++) {
        const outcome = outcomes[i];
        const outcomeId = outcome.outcome_id || `outcome_${i}_${outcome.created_at}`;
        if (!seen.has(`outcome_${outcomeId}`)) {
            signals.push({
                id: `outcome_${outcomeId}`,
                type: 'outcome',
                title: outcome.title || 'Untitled Outcome',
                summary: outcome.what_changed || outcome.title || '',
                timestamp: outcome.created_at,
                project_id: projectId,
                session_id: outcome.session_id,
                dispatch_id: outcome.dispatch_thread_id,
                outcome_id: outcomeId,
                status: outcome.status || 'partial',
                tags: extractTagsFromOutcome(outcome),
                pattern_ids: findPatternsForOutcome(outcome, patterns),
            });
            seen.add(`outcome_${outcomeId}`);
        }
    }
    // Add artifact signals
    const artifactEvents = events.filter((e) => e.event_type === 'artifact_generated');
    for (const event of artifactEvents) {
        const artifactId = event.content.artifacts?.[0] || event.event_id;
        if (!seen.has(`artifact_${artifactId}`)) {
            signals.push({
                id: `artifact_${artifactId}`,
                type: 'artifact',
                title: event.content.artifacts?.[0] || 'Generated Artifact',
                summary: event.content.summary,
                timestamp: event.timestamp,
                project_id: projectId,
                artifact_path: event.content.artifacts?.[0],
                session_id: event.session_id,
                dispatch_id: event.dispatch_id,
                status: 'success',
                tags: extractTagsFromEvent(event),
                pattern_ids: findPatternsForEvent(event, patterns),
            });
            seen.add(`artifact_${artifactId}`);
        }
    }
    // Add decision signals from patterns
    for (const pattern of patterns) {
        if (pattern.type === 'architecture-decision') {
            const decisionId = `decision_${pattern.pattern_id}`;
            if (!seen.has(decisionId)) {
                signals.push({
                    id: decisionId,
                    type: 'decision',
                    title: pattern.name,
                    summary: pattern.principle,
                    timestamp: pattern.lastDecision || fallbackTimestamp,
                    project_id: projectId,
                    status: 'success',
                    tags: ['architecture', 'decision'],
                    pattern_ids: [pattern.pattern_id],
                });
                seen.add(decisionId);
            }
        }
    }
    return signals.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
function getDeterministicTimestamp(events, outcomes) {
    const candidates = [];
    for (const event of events) {
        if (typeof event.timestamp === 'string' && event.timestamp.length > 0) {
            candidates.push(event.timestamp);
        }
    }
    for (const outcome of outcomes) {
        if (typeof outcome?.created_at === 'string' && outcome.created_at.length > 0) {
            candidates.push(outcome.created_at);
        }
    }
    if (candidates.length === 0) {
        return '1970-01-01T00:00:00.000Z';
    }
    candidates.sort();
    return candidates[candidates.length - 1];
}
/**
 * Extract tags from a ForgeEvent
 */
function extractTagsFromEvent(event) {
    const tags = new Set();
    // Event type
    tags.add(event.event_type);
    // Content keywords
    const content = `${event.content.summary} ${event.content.details || ''}`.toLowerCase();
    if (content.includes('refactor'))
        tags.add('refactoring');
    if (content.includes('design'))
        tags.add('design');
    if (content.includes('test'))
        tags.add('testing');
    if (content.includes('performance'))
        tags.add('performance');
    if (content.includes('security'))
        tags.add('security');
    if (content.includes('migration'))
        tags.add('migration');
    if (content.includes('cleanup'))
        tags.add('cleanup');
    return Array.from(tags).sort();
}
/**
 * Extract tags from an outcome
 */
function extractTagsFromOutcome(outcome) {
    const tags = new Set();
    // Status
    if (outcome.status === 'fail')
        tags.add('failure');
    if (outcome.status === 'success')
        tags.add('success');
    if (outcome.status === 'partial')
        tags.add('partial');
    // Content
    const content = `${outcome.title || ''} ${outcome.what_changed || ''} ${outcome.what_broke || ''}`.toLowerCase();
    if (content.includes('refactor'))
        tags.add('refactoring');
    if (content.includes('broken'))
        tags.add('breakage');
    if (content.includes('test'))
        tags.add('testing');
    if (content.includes('design'))
        tags.add('design');
    return Array.from(tags).sort();
}
/**
 * Find patterns that match an event
 */
function findPatternsForEvent(event, patterns) {
    const content = `${event.content.summary} ${event.content.details || ''}`.toLowerCase();
    return patterns
        .filter((p) => {
        const keywords = getPatternKeywords(p);
        return keywords.some((kw) => content.includes(kw.toLowerCase()));
    })
        .map((p) => p.pattern_id);
}
/**
 * Find patterns that match an outcome
 */
function findPatternsForOutcome(outcome, patterns) {
    const content = `${outcome.title || ''} ${outcome.what_changed || ''} ${outcome.what_broke || ''}`.toLowerCase();
    return patterns
        .filter((p) => {
        const keywords = getPatternKeywords(p);
        return keywords.some((kw) => content.includes(kw.toLowerCase()));
    })
        .map((p) => p.pattern_id);
}
/**
 * Get keywords for a pattern
 */
function getPatternKeywords(pattern) {
    if (pattern.type === 'failure-mode')
        return pattern.keywords || [];
    if (pattern.type === 'refactor-theme')
        return [pattern.name];
    if (pattern.type === 'architecture-decision')
        return [pattern.name, pattern.principle];
    if (pattern.type === 'friction-point')
        return [pattern.name];
    if (pattern.type === 'acceptance-criteria')
        return pattern.criteria || [];
    return [];
}
/**
 * Serialize signal index to JSON string
 */
function serializeSignalIndex(index) {
    return JSON.stringify(index, null, 2);
}
exports.serializeSignalIndex = serializeSignalIndex;
/**
 * Parse signal index from JSON string
 */
function deserializeSignalIndex(json) {
    return JSON.parse(json);
}
exports.deserializeSignalIndex = deserializeSignalIndex;

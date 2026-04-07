"use strict";
/**
 * Event Tagging System - Deterministic tags assigned through rule-based logic
 *
 * Tags enable pattern extraction by classifying events into semantic domains.
 * All tagging is deterministic and rule-based (no AI, no fuzzy logic).
 *
 * Tags represent stable engineering concerns across projects:
 * - architecture: System design, invariants, refactoring
 * - normalization: Data canonicalization, cleanup, migration
 * - runtime-path: Execution flow, tracing, performance
 * - source-of-truth: Event stream integrity, determinism verification
 * - artifact-routing: Where/how artifacts are stored, paths
 * - validation: Testing, checks, assertions, completeness
 * - regression: Bugs, failures, breakages, fixes
 * - cleanup: Debt removal, dead code, simplification
 * - migration: Schema/contract changes, transitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tagStatistics = exports.groupByTag = exports.filterByTag = exports.tagEvents = exports.tagEvent = void 0;
/**
 * Deterministic rules for assigning tags to events.
 * Rules are evaluated in order and accumulate all matching tags.
 */
function extractTags(event) {
    const tags = new Set();
    // Rule 1: Event type categorization
    if (event.event_type === 'dispatch_seeded' ||
        event.event_type === 'dispatch_refreshed' ||
        event.event_type === 'dispatch_candidate_created') {
        tags.add('runtime-path');
    }
    if (event.event_type === 'session_started' ||
        event.event_type === 'session_ended') {
        tags.add('source-of-truth');
    }
    if (event.event_type === 'artifact_generated') {
        tags.add('artifact-routing');
    }
    if (event.event_type === 'outcome_logged') {
        tags.add('validation');
        // Outcomes often capture failures or changes
        if (event.content.status === 'fail') {
            tags.add('regression');
        }
    }
    // Rule 2: Role-based categorization
    if (event.role === 'system') {
        tags.add('source-of-truth');
    }
    if (event.role === 'observer') {
        tags.add('validation');
    }
    if (event.role === 'worker') {
        tags.add('runtime-path');
    }
    // Rule 3: Content pattern matching
    const summary = event.content.summary.toLowerCase();
    const details = (event.content.details || '').toLowerCase();
    const contentText = `${summary} ${details}`;
    // Architecture keywords
    if (contentText.includes('architecture') ||
        contentText.includes('invariant') ||
        contentText.includes('design') ||
        contentText.includes('constraint') ||
        contentText.includes('refactor') ||
        contentText.includes('semantic')) {
        tags.add('architecture');
    }
    // Normalization keywords
    if (contentText.includes('normalize') ||
        contentText.includes('canonical') ||
        contentText.includes('clean') ||
        contentText.includes('migrate') ||
        contentText.includes('transform')) {
        tags.add('normalization');
    }
    // Runtime/path keywords
    if (contentText.includes('path') ||
        contentText.includes('routing') ||
        contentText.includes('flow') ||
        contentText.includes('trace') ||
        contentText.includes('dispatch') ||
        contentText.includes('thread')) {
        tags.add('runtime-path');
    }
    // Validation keywords
    if (contentText.includes('test') ||
        contentText.includes('validat') ||
        contentText.includes('check') ||
        contentText.includes('assert') ||
        contentText.includes('verify') ||
        contentText.includes('schema')) {
        tags.add('validation');
    }
    // Regression keywords
    if (contentText.includes('regression') ||
        contentText.includes('fail') ||
        contentText.includes('break') ||
        contentText.includes('bug') ||
        contentText.includes('error') ||
        contentText.includes('fix') ||
        contentText.includes('broken')) {
        tags.add('regression');
    }
    // Cleanup keywords
    if (contentText.includes('cleanup') ||
        contentText.includes('dead code') ||
        contentText.includes('remove') ||
        contentText.includes('simplif') ||
        contentText.includes('obsolete') ||
        contentText.includes('deprecat')) {
        tags.add('cleanup');
    }
    // Migration keywords
    if (contentText.includes('migrat') ||
        contentText.includes('schema') ||
        contentText.includes('contract') ||
        contentText.includes('transition')) {
        tags.add('migration');
    }
    // Artifact routing keywords
    if (contentText.includes('artifact') ||
        contentText.includes('docs/') ||
        contentText.includes('output') ||
        contentText.includes('generate') ||
        contentText.includes('write')) {
        tags.add('artifact-routing');
    }
    return Array.from(tags).sort();
}
/**
 * Apply deterministic tags to an event.
 * Tags are computed fresh each time from event data (no state mutation).
 */
function tagEvent(event) {
    const tags = extractTags(event);
    return {
        event,
        tags,
    };
}
exports.tagEvent = tagEvent;
/**
 * Extract tags from array of events, returning map of event_id -> tags
 */
function tagEvents(events) {
    const result = new Map();
    for (const event of events) {
        const tags = extractTags(event);
        result.set(event.event_id, tags);
    }
    return result;
}
exports.tagEvents = tagEvents;
/**
 * Filter events by tag. Single tag or multiple (OR logic).
 */
function filterByTag(events, tags) {
    const eventTags = tagEvents(events);
    return events.filter((e) => {
        const eTags = eventTags.get(e.event_id) || [];
        return tags.some((t) => eTags.includes(t));
    });
}
exports.filterByTag = filterByTag;
/**
 * Group events by their tags.
 * Returns map of tag -> events that have that tag.
 */
function groupByTag(events) {
    const eventTags = tagEvents(events);
    const groups = new Map();
    const allTags = new Set();
    eventTags.forEach((tags) => {
        tags.forEach((t) => allTags.add(t));
    });
    for (const tag of allTags) {
        const tagged = events.filter((e) => {
            const eTags = eventTags.get(e.event_id) || [];
            return eTags.includes(tag);
        });
        if (tagged.length > 0) {
            groups.set(tag, tagged);
        }
    }
    return groups;
}
exports.groupByTag = groupByTag;
/**
 * Get summary statistics about tag distribution in event set.
 */
function tagStatistics(events) {
    const eventTags = tagEvents(events);
    const stats = {
        'architecture': 0,
        'normalization': 0,
        'runtime-path': 0,
        'source-of-truth': 0,
        'artifact-routing': 0,
        'validation': 0,
        'regression': 0,
        'cleanup': 0,
        'migration': 0,
    };
    eventTags.forEach((tags) => {
        tags.forEach((tag) => {
            stats[tag]++;
        });
    });
    return stats;
}
exports.tagStatistics = tagStatistics;

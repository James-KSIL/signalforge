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
import { ForgeEvent } from './event.types';
export type EventTag = 'architecture' | 'normalization' | 'runtime-path' | 'source-of-truth' | 'artifact-routing' | 'validation' | 'regression' | 'cleanup' | 'migration';
/**
 * Apply deterministic tags to an event.
 * Tags are computed fresh each time from event data (no state mutation).
 */
export declare function tagEvent(event: ForgeEvent): {
    event: ForgeEvent;
    tags: EventTag[];
};
/**
 * Extract tags from array of events, returning map of event_id -> tags
 */
export declare function tagEvents(events: ForgeEvent[]): Map<string, EventTag[]>;
/**
 * Filter events by tag. Single tag or multiple (OR logic).
 */
export declare function filterByTag(events: ForgeEvent[], tags: EventTag[]): ForgeEvent[];
/**
 * Group events by their tags.
 * Returns map of tag -> events that have that tag.
 */
export declare function groupByTag(events: ForgeEvent[]): Map<EventTag, ForgeEvent[]>;
/**
 * Get summary statistics about tag distribution in event set.
 */
export declare function tagStatistics(events: ForgeEvent[]): Record<EventTag, number>;

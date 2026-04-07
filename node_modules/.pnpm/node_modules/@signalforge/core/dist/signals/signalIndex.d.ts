/**
 * Signal Index Generator
 *
 * Creates a lightweight machine-readable JSON index of major decisions and outcomes
 * for a project. Serves as the substrate for later analysis and Blacksmith work.
 *
 * Output: docs/<project_id>/signal/signal-index.json
 */
import { ForgeEvent } from '../events/event.types';
import { DetectedPattern, PatternId } from '../patterns/patternTypes';
/**
 * A single signal entry in the index
 */
export interface SignalEntry {
    id: string;
    type: 'dispatch' | 'session' | 'outcome' | 'decision' | 'artifact';
    title: string;
    summary: string;
    timestamp: string;
    project_id: string;
    session_id?: string;
    dispatch_id?: string;
    outcome_id?: string;
    artifact_path?: string;
    status?: 'success' | 'fail' | 'partial' | 'active' | 'closed';
    tags: string[];
    related_signals?: string[];
    pattern_ids?: PatternId[];
}
/**
 * Full signal index for a project
 */
export interface SignalIndex {
    version: string;
    generated_at: string;
    project_id: string;
    time_range: {
        start: string;
        end: string;
    };
    summary: {
        total_signals: number;
        by_type: Record<string, number>;
        by_status: Record<string, number>;
        unique_sessions: number;
        unique_dispatches: number;
    };
    signals: SignalEntry[];
    patterns: {
        total_detected: number;
        by_category: Record<string, number>;
        highest_severity_patterns: Array<{
            pattern_id: PatternId;
            name: string;
            severity?: string;
        }>;
    };
    tags: {
        all_tags: string[];
        tag_frequency: Record<string, number>;
    };
    metadata: {
        deterministic: true;
        source: 'canonical-event-stream';
        validated: boolean;
    };
    dispatch_ids: string[];
    session_ids: string[];
    outcome_summaries: string[];
    artifact_references: string[];
    recurring_tags: string[];
    pattern_ids: PatternId[];
    output_path: string;
    signal_index_path: string;
    insights_path: string;
    portfolio_path: string;
}
/**
 * Generate signal index from events, outcomes, and patterns
 */
export declare function generateSignalIndex(projectId: string, events: ForgeEvent[], outcomes?: any[], patterns?: DetectedPattern[], timeRangeStart?: string, timeRangeEnd?: string): SignalIndex;
/**
 * Serialize signal index to JSON string
 */
export declare function serializeSignalIndex(index: SignalIndex): string;
/**
 * Parse signal index from JSON string
 */
export declare function deserializeSignalIndex(json: string): SignalIndex;

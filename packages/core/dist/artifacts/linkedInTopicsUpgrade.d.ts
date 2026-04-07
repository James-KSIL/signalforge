/**
 * Pattern-Aware LinkedIn Topics Generator (Upgraded)
 *
 * Generates 3-5 topics from multi-session patterns and recurring themes,
 * not just session-local activity.
 *
 * Maintains deterministic, local-only operation.
 * Topics are grouped by:
 * - Engineering lessons
 * - Business/operational angles
 * - What remains private
 */
import { ForgeEvent } from '../events/event.types';
import { DetectedPattern } from '../patterns/patternTypes';
/**
 * LinkedIn topic entry
 */
export interface LinkedInTopic {
    title: string;
    category: 'engineering_lesson' | 'business_angle' | 'private';
    narrative: string;
    hashtags: string[];
    call_to_action?: string;
    is_public: boolean;
    source_pattern_ids: string[];
}
/**
 * LinkedIn topics collection for sharing
 */
export interface LinkedInTopicsCollection {
    generated_at: string;
    project_id: string;
    session_id?: string;
    sessions_analyzed: number;
    periods_covered: string;
    topics: LinkedInTopic[];
}
/**
 * Generate pattern-aware LinkedIn topics from multi-session history
 */
export declare function generateLinkedInTopics(projectId: string, events: ForgeEvent[], patterns: DetectedPattern[], sessionId?: string, multiSessionSpan?: {
    sessions: number;
    dateRange: string;
}): LinkedInTopicsCollection;
/**
 * Serialize topics collection to markdown
 */
export declare function renderLinkedInTopicsMarkdown(collection: LinkedInTopicsCollection): string;
/**
 * Export topics for social media
 */
export declare function exportForSocialMedia(topic: LinkedInTopic): {
    text: string;
    hashtags: string;
};
/**
 * Merge topics from multiple sources (maintain deduplication)
 */
export declare function mergeTopicsCollections(collections: LinkedInTopicsCollection[]): LinkedInTopicsCollection;

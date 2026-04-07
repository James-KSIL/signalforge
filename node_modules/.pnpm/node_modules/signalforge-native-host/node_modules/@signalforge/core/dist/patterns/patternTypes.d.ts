/**
 * Pattern Types and Structures
 *
 * Represents recurring engineering patterns detected from events and outcomes.
 * Patterns are deterministically identified and stable across runs.
 */
import { EventTag } from '../events/eventTags';
/**
 * Unique identifier for a pattern class.
 * Format: `pattern_<category>_<subtype>`
 * Deterministic based on pattern properties, not random.
 */
export type PatternId = string & {
    readonly __brand: 'PatternId';
};
export declare function createPatternId(category: string, subtype: string): PatternId;
/**
 * Pattern Category - high-level engineering domain
 */
export type PatternCategory = 'failure-mode' | 'refactor-theme' | 'architecture-decision' | 'friction-point' | 'acceptance-criteria' | 'data-issue' | 'design-pattern' | 'performance-concern';
/**
 * Failure Mode Pattern
 * Recurring type of failure or bug
 */
export interface FailureModePattern {
    type: 'failure-mode';
    pattern_id: PatternId;
    name: string;
    description: string;
    keywords: string[];
    affectedComponents: string[];
    occurrences: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    resolutions: string[];
    lastOccurrence: string;
}
/**
 * Refactoring Theme Pattern
 * Recurring refactor or cleanup activity
 */
export interface RefactorThemePattern {
    type: 'refactor-theme';
    pattern_id: PatternId;
    name: string;
    description: string;
    affectedModules: string[];
    occurrences: number;
    valueDelivered: string;
    estimatedEffort: 'low' | 'medium' | 'high';
    lastOccurrence: string;
}
/**
 * Architecture Decision Pattern
 * Recurring architectural choice or constraint
 */
export interface ArchitectureDecisionPattern {
    type: 'architecture-decision';
    pattern_id: PatternId;
    name: string;
    principle: string;
    rationale: string;
    affectedAreas: string[];
    decisions: number;
    tradeoffs: string[];
    alternatives: string[];
    lastDecision: string;
}
/**
 * Friction Point Pattern
 * Recurring workflow challenge or blockers
 */
export interface FrictionPointPattern {
    type: 'friction-point';
    pattern_id: PatternId;
    name: string;
    description: string;
    frequency: number;
    impactArea: string;
    symptoms: string[];
    workarounds: string[];
    lastEncountered: string;
}
/**
 * Acceptance Criteria Pattern
 * Recurring quality or acceptance criteria
 */
export interface AcceptanceCriteriaPattern {
    type: 'acceptance-criteria';
    pattern_id: PatternId;
    name: string;
    criteria: string[];
    occurrences: number;
    passingRate: number;
    relatedTags: EventTag[];
    lastValidation: string;
}
/**
 * Union of all pattern types
 */
export type DetectedPattern = FailureModePattern | RefactorThemePattern | ArchitectureDecisionPattern | FrictionPointPattern | AcceptanceCriteriaPattern;
/**
 * Pattern context from events that triggered detection
 */
export interface PatternContext {
    pattern_id: PatternId;
    detected_at: string;
    evidence_events: string[];
    affected_sessions: string[];
    affected_dispatches: string[];
    related_outcomes: string[];
    tags: EventTag[];
    confidence: number;
}
/**
 * Pattern Collection - all patterns detected in a project across time range
 */
export interface PatternCollection {
    project_id: string;
    time_range_start: string;
    time_range_end: string;
    patterns: DetectedPattern[];
    contexts: Map<PatternId, PatternContext[]>;
    total_patterns: number;
    unique_pattern_ids: number;
    most_frequent: PatternId[];
    highest_severity: PatternId[];
}
/**
 * Pattern Frequency Summary
 * Used for portfolio/insights generation
 */
export interface PatternFrequency {
    pattern_id: PatternId;
    name: string;
    category: PatternCategory;
    frequency: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    lastSeen: string;
}
/**
 * Pattern Relationship
 * Shows how patterns connect/influence each other
 */
export interface PatternRelationship {
    pattern_a: PatternId;
    pattern_b: PatternId;
    relationship_type: 'causes' | 'exacerbates' | 'refines' | 'blocks' | 'enables';
    strength: number;
}
/**
 * Check if object is a DetectedPattern
 */
export declare function isDetectedPattern(x: any): x is DetectedPattern;
/**
 * Safe type guard for specific pattern types
 */
export declare function isFailureModePattern(x: any): x is FailureModePattern;
export declare function isArchitectureDecisionPattern(x: any): x is ArchitectureDecisionPattern;
export declare function isFrictionPointPattern(x: any): x is FrictionPointPattern;

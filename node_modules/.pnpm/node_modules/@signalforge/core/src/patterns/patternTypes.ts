/**
 * Pattern Types and Structures
 * 
 * Represents recurring engineering patterns detected from events and outcomes.
 * Patterns are deterministically identified and stable across runs.
 */

import { ForgeEvent, EventType } from '../events/event.types';
import { EventTag } from '../events/eventTags';

/**
 * Unique identifier for a pattern class.
 * Format: `pattern_<category>_<subtype>` 
 * Deterministic based on pattern properties, not random.
 */
export type PatternId = string & { readonly __brand: 'PatternId' };

export function createPatternId(category: string, subtype: string): PatternId {
  // Deterministic ID from category + subtype
  return `pattern_${category}_${subtype}` as PatternId;
}

/**
 * Pattern Category - high-level engineering domain
 */
export type PatternCategory =
  | 'failure-mode'
  | 'refactor-theme'
  | 'architecture-decision'
  | 'friction-point'
  | 'acceptance-criteria'
  | 'data-issue'
  | 'design-pattern'
  | 'performance-concern';

/**
 * Failure Mode Pattern
 * Recurring type of failure or bug
 */
export interface FailureModePattern {
  type: 'failure-mode';
  pattern_id: PatternId;
  name: string; // e.g. "null-thread-id-mismatch"
  description: string;
  keywords: string[]; // patterns that trigger this
  affectedComponents: string[]; // which modules/areas
  occurrences: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resolutions: string[]; // how it was fixed
  lastOccurrence: string; // ISO timestamp
}

/**
 * Refactoring Theme Pattern
 * Recurring refactor or cleanup activity
 */
export interface RefactorThemePattern {
  type: 'refactor-theme';
  pattern_id: PatternId;
  name: string; // e.g. "unused-imports-cleanup"
  description: string;
  affectedModules: string[];
  occurrences: number;
  valueDelivered: string; // what was improved
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
  name: string; // e.g. "deterministic-artifact-generation"
  principle: string; // the decision principle
  rationale: string; // why this matters
  affectedAreas: string[];
  decisions: number; // how many times decided
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
  name: string; // e.g. "schema-migration-complexity"
  description: string;
  frequency: number; // how often encountered
  impactArea: string; // what it affects
  symptoms: string[]; // how it manifests
  workarounds: string[]; // current approaches
  lastEncountered: string;
}

/**
 * Acceptance Criteria Pattern
 * Recurring quality or acceptance criteria
 */
export interface AcceptanceCriteriaPattern {
  type: 'acceptance-criteria';
  pattern_id: PatternId;
  name: string; // e.g. "determinism-validation"
  criteria: string[]; // what must be true
  occurrences: number; // how often checked
  passingRate: number; // 0-1, pass rate
  relatedTags: EventTag[]; // which event tags relate
  lastValidation: string;
}

/**
 * Union of all pattern types
 */
export type DetectedPattern =
  | FailureModePattern
  | RefactorThemePattern
  | ArchitectureDecisionPattern
  | FrictionPointPattern
  | AcceptanceCriteriaPattern;

/**
 * Pattern context from events that triggered detection
 */
export interface PatternContext {
  pattern_id: PatternId;
  detected_at: string;
  evidence_events: string[]; // event_ids that show this pattern
  affected_sessions: string[];
  affected_dispatches: string[];
  related_outcomes: string[]; // outcome_ids
  tags: EventTag[];
  confidence: number; // 0-1: certainty of pattern
}

/**
 * Pattern Collection - all patterns detected in a project across time range
 */
export interface PatternCollection {
  project_id: string;
  time_range_start: string; // ISO date
  time_range_end: string; // ISO date
  patterns: DetectedPattern[];
  contexts: Map<PatternId, PatternContext[]>;

  // Metrics
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
  strength: number; // 0-1: how strong the relationship
}

/**
 * Check if object is a DetectedPattern
 */
export function isDetectedPattern(x: any): x is DetectedPattern {
  return x && typeof x === 'object' && 'type' in x && 'pattern_id' in x;
}

/**
 * Safe type guard for specific pattern types
 */
export function isFailureModePattern(x: any): x is FailureModePattern {
  return x && x.type === 'failure-mode' && Array.isArray(x.keywords);
}

export function isArchitectureDecisionPattern(x: any): x is ArchitectureDecisionPattern {
  return x && x.type === 'architecture-decision' && typeof x.principle === 'string';
}

export function isFrictionPointPattern(x: any): x is FrictionPointPattern {
  return x && x.type === 'friction-point' && Array.isArray(x.symptoms);
}

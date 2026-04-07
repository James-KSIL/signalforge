/**
 * Pattern Detection Rules - Deterministic pattern extraction
 *
 * Rules are pure functions that examine events and identify recurring patterns.
 * All detection is algorithmic and rule-based (no AI, no learned models).
 */
import { ForgeEvent } from '../events/event.types';
import { EventTag } from '../events/eventTags';
import { DetectedPattern, FailureModePattern, RefactorThemePattern, ArchitectureDecisionPattern, FrictionPointPattern, AcceptanceCriteriaPattern } from './patternTypes';
/**
 * Detects failure mode patterns from failure/error outcomes
 */
export declare function detectFailureModes(events: ForgeEvent[], outcomes: any[]): FailureModePattern[];
/**
 * Detects refactoring/cleanup themes from event patterns
 */
export declare function detectRefactorThemes(events: ForgeEvent[]): RefactorThemePattern[];
/**
 * Detects recurring architecture decisions
 */
export declare function detectArchitectureDecisions(events: ForgeEvent[], taggedEvents: Map<string, EventTag[]>): ArchitectureDecisionPattern[];
/**
 * Detects workflow friction points
 */
export declare function detectFrictionPoints(events: ForgeEvent[], taggedEvents: Map<string, EventTag[]>): FrictionPointPattern[];
/**
 * Detects recurring acceptance criteria and validation patterns
 */
export declare function detectAcceptanceCriteria(events: ForgeEvent[], taggedEvents: Map<string, EventTag[]>): AcceptanceCriteriaPattern[];
/**
 * Run all pattern detection rules
 */
export declare function detectAllPatterns(events: ForgeEvent[], outcomes?: any[]): DetectedPattern[];

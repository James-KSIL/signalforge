/**
 * Pattern Extractor - Main entry point for deterministic pattern extraction
 *
 * Coordinates detection of all pattern types from event stream and outcomes.
 */
import { ForgeEvent } from '../events/event.types';
import { DetectedPattern, PatternCollection, PatternFrequency, PatternRelationship } from './patternTypes';
/**
 * Extract all patterns from events and outcomes
 */
export declare function extractPatterns(projectId: string, events: ForgeEvent[], outcomes?: any[], timeRangeStart?: string, timeRangeEnd?: string): PatternCollection;
/**
 * Compute pattern frequencies for trend analysis
 */
export declare function computePatternFrequencies(patterns: DetectedPattern[], historicalPatterns?: DetectedPattern[]): PatternFrequency[];
/**
 * Identify relationships between patterns
 */
export declare function identifyPatternRelationships(patterns: DetectedPattern[]): PatternRelationship[];

/**
 * Pattern Extractor - Main entry point for deterministic pattern extraction
 * 
 * Coordinates detection of all pattern types from event stream and outcomes.
 */

import { ForgeEvent } from '../events/event.types';
import { EventTag, tagEvents, groupByTag } from '../events/eventTags';
import {
  DetectedPattern,
  PatternId,
  PatternCollection,
  PatternContext,
  PatternFrequency,
  PatternRelationship,
  createPatternId,
} from './patternTypes';
import { detectAllPatterns } from './patternRules';

/**
 * Extract all patterns from events and outcomes
 */
export function extractPatterns(
  projectId: string,
  events: ForgeEvent[],
  outcomes: any[] = [],
  timeRangeStart?: string,
  timeRangeEnd?: string
): PatternCollection {
  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const deterministicTimestamp = getDeterministicTimestamp(sortedEvents, outcomes);

  // Get time range from events if not provided
  const start = timeRangeStart || (sortedEvents[0]?.timestamp) || deterministicTimestamp;
  const end = timeRangeEnd || (sortedEvents[sortedEvents.length - 1]?.timestamp) || deterministicTimestamp;

  // Detect all patterns
  const patterns = detectAllPatterns(sortedEvents, outcomes).map((pattern) => {
    const patternIdParts = String(pattern.pattern_id || '').split('_');
    const subtype = patternIdParts.slice(2).join('_') || String((pattern as any).name || 'unknown');
    return {
      ...pattern,
      category: (pattern as any).category || pattern.type,
      subtype: (pattern as any).subtype || subtype,
    };
  });

  // Build pattern contexts (evidence linking)
  const contexts = buildPatternContexts(projectId, patterns, events, outcomes, end);

  // Compute metrics
  const uniqueIds = new Set(patterns.map((p) => p.pattern_id));
  const frequencyMap = new Map<PatternId, number>();
  patterns.forEach((p) => {
    frequencyMap.set(p.pattern_id, (frequencyMap.get(p.pattern_id) ?? 0) + 1);
  });

  const mostFrequent = Array.from(frequencyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map((e) => e[0])
    .slice(0, 5);

  const highestSeverity = patterns
    .filter((p) => p.type === 'failure-mode')
    .sort((a: any, b: any) => {
      const severityMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      const bRank = severityMap[b.severity as string] ?? 0;
      const aRank = severityMap[a.severity as string] ?? 0;
      return bRank - aRank;
    })
    .map((p) => p.pattern_id)
    .slice(0, 3);

  return {
    project_id: projectId,
    time_range_start: start,
    time_range_end: end,
    patterns,
    contexts,
    total_patterns: patterns.length,
    unique_pattern_ids: uniqueIds.size,
    most_frequent: mostFrequent,
    highest_severity: highestSeverity,
  };
}

/**
 * Build pattern contexts showing evidence from events
 */
function buildPatternContexts(
  projectId: string,
  patterns: DetectedPattern[],
  events: ForgeEvent[],
  outcomes: any[],
  detectedAt: string
): Map<PatternId, PatternContext[]> {
  const contexts = new Map<PatternId, PatternContext[]>();
  const eventTags = tagEvents(events);
  const eventsByProject = events.filter((e) => e.project_id === projectId);

  for (const pattern of patterns) {
    const context: PatternContext = {
      pattern_id: pattern.pattern_id,
      detected_at: detectedAt,
      evidence_events: findEvidenceEvents(pattern, eventsByProject, eventTags),
      affected_sessions: findAffectedSessions(pattern, eventsByProject),
      affected_dispatches: findAffectedDispatches(pattern, eventsByProject),
      related_outcomes: findRelatedOutcomes(pattern, outcomes),
      tags: extractPatternTags(pattern, eventTags, eventsByProject),
      confidence: computeConfidence(pattern, eventsByProject),
    };

    if (!contexts.has(pattern.pattern_id)) {
      contexts.set(pattern.pattern_id, []);
    }
    contexts.get(pattern.pattern_id)!.push(context);
  }

  return contexts;
}

/**
 * Find events that provide evidence for a pattern
 */
function findEvidenceEvents(pattern: DetectedPattern, events: ForgeEvent[], taggedEvents: Map<string, EventTag[]>): string[] {
  const evidence: string[] = [];

  const keywords = getPatternKeywords(pattern);
  const patternTags = getPatternTags(pattern);

  for (const event of events) {
    const eventTags = taggedEvents.get(event.event_id) || [];
    const content = `${event.content.summary} ${event.content.details || ''}`.toLowerCase();

    // Match by keywords
    if (keywords.some((kw) => content.includes(kw.toLowerCase()))) {
      evidence.push(event.event_id);
      continue;
    }

    // Match by tags
    if (patternTags.some((tag) => eventTags.includes(tag))) {
      evidence.push(event.event_id);
    }
  }

  return Array.from(new Set(evidence)).slice(0, 20);
}

/**
 * Get affected session IDs for a pattern
 */
function findAffectedSessions(pattern: DetectedPattern, events: ForgeEvent[]): string[] {
  const keywords = getPatternKeywords(pattern);
  const sessions = new Set<string>();

  for (const event of events) {
    const content = `${event.content.summary} ${event.content.details || ''}`.toLowerCase();
    if (event.session_id && keywords.some((kw) => content.includes(kw.toLowerCase()))) {
      sessions.add(event.session_id);
    }
  }

  return Array.from(sessions);
}

/**
 * Get affected dispatch IDs for a pattern
 */
function findAffectedDispatches(pattern: DetectedPattern, events: ForgeEvent[]): string[] {
  const keywords = getPatternKeywords(pattern);
  const dispatches = new Set<string>();

  for (const event of events) {
    const content = `${event.content.summary} ${event.content.details || ''}`.toLowerCase();
    if (event.dispatch_id && keywords.some((kw) => content.includes(kw.toLowerCase()))) {
      dispatches.add(event.dispatch_id);
    }
  }

  return Array.from(dispatches);
}

/**
 * Get related outcome IDs for a pattern
 */
function findRelatedOutcomes(pattern: DetectedPattern, outcomes: any[]): string[] {
  const keywords = getPatternKeywords(pattern);
  const related: string[] = [];

  for (const outcome of outcomes) {
    const text = `${outcome.title || ''} ${outcome.what_broke || ''} ${outcome.what_changed || ''}`.toLowerCase();
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      const fallback = [outcome.dispatch_thread_id, outcome.session_id, outcome.created_at, pattern.pattern_id]
        .filter((value) => typeof value === 'string' && value.length > 0)
        .join('_') || 'unknown';
      related.push(outcome.outcome_id || `outcome_${fallback}`);
    }
  }

  return related;
}

/**
 * Extract event tags relevant to a pattern
 */
function extractPatternTags(pattern: DetectedPattern, taggedEvents: Map<string, EventTag[]>, events: ForgeEvent[]): EventTag[] {
  const tags = new Set<EventTag>();
  const keywords = getPatternKeywords(pattern);

  for (const event of events) {
    const content = `${event.content.summary} ${event.content.details || ''}`.toLowerCase();
    if (keywords.some((kw) => content.includes(kw.toLowerCase()))) {
      const eventTags = taggedEvents.get(event.event_id) || [];
      eventTags.forEach((t) => tags.add(t));
    }
  }

  return Array.from(tags).sort();
}

/**
 * Compute confidence score for a pattern
 * 0-1: higher = more confident this is a real pattern
 */
function computeConfidence(pattern: DetectedPattern, events: ForgeEvent[]): number {
  // Base confidence on pattern type and evidence
  let confidence = 0.5;

  if (pattern.type === 'failure-mode') {
    // Failure modes with multiple occurrences are more confident
    confidence += Math.min(pattern.occurrences / 5, 0.4);
  } else if (pattern.type === 'refactor-theme') {
    confidence += Math.min(pattern.occurrences / 3, 0.4);
  } else if (pattern.type === 'architecture-decision') {
    confidence += Math.min(pattern.decisions / 5, 0.4);
  } else if (pattern.type === 'friction-point') {
    confidence += Math.min(pattern.frequency / 5, 0.4);
  }

  return Math.min(confidence, 1.0);
}

/**
 * Get keywords for a pattern
 */
function getPatternKeywords(pattern: DetectedPattern): string[] {
  if (pattern.type === 'failure-mode') return pattern.keywords;
  if (pattern.type === 'refactor-theme') return [pattern.name, ...pattern.affectedModules];
  if (pattern.type === 'architecture-decision') return [pattern.name, pattern.principle];
  if (pattern.type === 'friction-point') return [pattern.name, ...pattern.symptoms];
  if (pattern.type === 'acceptance-criteria') return pattern.criteria;
  return [];
}

/**
 * Get tags for a pattern
 */
function getPatternTags(pattern: DetectedPattern): EventTag[] {
  if (pattern.type === 'failure-mode') return ['regression', 'validation'];
  if (pattern.type === 'refactor-theme') return ['cleanup', 'architecture'];
  if (pattern.type === 'architecture-decision') return ['architecture', 'source-of-truth'];
  if (pattern.type === 'friction-point') return ['runtime-path', 'normalization'];
  if (pattern.type === 'acceptance-criteria') return pattern.relatedTags;
  return [];
}

/**
 * Compute pattern frequencies for trend analysis
 */
export function computePatternFrequencies(
  patterns: DetectedPattern[],
  historicalPatterns?: DetectedPattern[]
): PatternFrequency[] {
  const frequencies: Map<PatternId, PatternFrequency> = new Map();

  for (const pattern of patterns) {
    const frequency: PatternFrequency = {
      pattern_id: pattern.pattern_id,
      name: pattern.name,
      category: pattern.type as any,
      frequency:
        pattern.type === 'failure-mode'
          ? (pattern as any).occurrences
          : pattern.type === 'refactor-theme'
            ? (pattern as any).occurrences
            : pattern.type === 'friction-point'
              ? (pattern as any).frequency
              : 1,
      trend: 'stable',
      lastSeen:
        (pattern as any).lastOccurrence ||
        (pattern as any).lastDecision ||
        '1970-01-01T00:00:00.000Z',
    };

    frequencies.set(pattern.pattern_id, frequency);
  }

  // Compute trends if historical data available
  if (historicalPatterns) {
    const historicalIds = new Map<PatternId, number>();
    for (const p of historicalPatterns) {
      const freq =
        p.type === 'failure-mode'
          ? (p as any).occurrences
          : p.type === 'refactor-theme'
            ? (p as any).occurrences
            : p.type === 'friction-point'
              ? (p as any).frequency
              : 1;
      historicalIds.set(p.pattern_id, freq);
    }

    for (const [id, freq] of frequencies) {
      const histFreq = historicalIds.get(id);
      if (histFreq !== undefined) {
        if (freq.frequency > histFreq) {
          freq.trend = 'increasing';
        } else if (freq.frequency < histFreq) {
          freq.trend = 'decreasing';
        }
      }
    }
  }

  return Array.from(frequencies.values()).sort((a, b) => b.frequency - a.frequency);
}

function getDeterministicTimestamp(events: ForgeEvent[], outcomes: any[]): string {
  const candidates: string[] = [];
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
 * Identify relationships between patterns
 */
export function identifyPatternRelationships(patterns: DetectedPattern[]): PatternRelationship[] {
  const relationships: PatternRelationship[] = [];

  // Simple heuristic: patterns with shared components/tags may be related
  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      const p1 = patterns[i];
      const p2 = patterns[j];

      // Check for causal relationships
      if (
        p1.type === 'failure-mode' &&
        p2.type === 'friction-point' &&
        getPatternKeywords(p1).some((kw) => getPatternKeywords(p2).join(' ').includes(kw))
      ) {
        relationships.push({
          pattern_a: p1.pattern_id,
          pattern_b: p2.pattern_id,
          relationship_type: 'causes',
          strength: 0.7,
        });
      }

      // Check for refinement relationships (architecture decisions refine each other)
      if (p1.type === 'architecture-decision' && p2.type === 'architecture-decision') {
        if (
          (p1 as any).affectedAreas.some((a: string) =>
            (p2 as any).affectedAreas.some((b: string) => a === b)
          )
        ) {
          relationships.push({
            pattern_a: p1.pattern_id,
            pattern_b: p2.pattern_id,
            relationship_type: 'refines',
            strength: 0.6,
          });
        }
      }
    }
  }

  return relationships;
}

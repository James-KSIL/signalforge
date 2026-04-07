/**
 * Pattern Detection Rules - Deterministic pattern extraction
 * 
 * Rules are pure functions that examine events and identify recurring patterns.
 * All detection is algorithmic and rule-based (no AI, no learned models).
 */

import { ForgeEvent } from '../events/event.types';
import { EventTag, tagEvents } from '../events/eventTags';
import {
  DetectedPattern,
  PatternId,
  FailureModePattern,
  RefactorThemePattern,
  ArchitectureDecisionPattern,
  FrictionPointPattern,
  AcceptanceCriteriaPattern,
  createPatternId,
  PatternContext,
} from './patternTypes';

/**
 * Detects failure mode patterns from failure/error outcomes
 */
export function detectFailureModes(events: ForgeEvent[], outcomes: any[]): FailureModePattern[] {
  const patterns = new Map<string, FailureModePattern>();
  const deterministicTimestamp = getDeterministicTimestamp(events, outcomes);

  // Find outcome events with fail status
  const failureOutcomes = outcomes.filter((o) => o.status === 'fail' || o.status === 'failed');

  for (const outcome of failureOutcomes) {
    const title = (outcome.title || '').toLowerCase();
    const details = (outcome.what_broke || '').toLowerCase();
    const combined = `${title} ${details}`;

    // Pattern 1: Null or missing thread ID issues
    if (combined.includes('thread') && (combined.includes('null') || combined.includes('undefined'))) {
      const patternId = createPatternId('failure-mode', 'null-thread-id');
      patterns.set(patternId, {
        type: 'failure-mode',
        pattern_id: patternId,
        name: 'null-thread-id-mismatch',
        description: 'Thread ID is null or undefined when expected',
        keywords: ['thread', 'null', 'undefined', 'mismatch'],
        affectedComponents: ['outcomeRepository', 'eventHelpers', 'chatEventRepository'],
        occurrences: (patterns.get(patternId)?.occurrences ?? 0) + 1,
        severity: 'high',
        resolutions: ['ensure thread_id is resolved before row insertion', 'use fallback logic for thread_id'],
        lastOccurrence: outcome.created_at || deterministicTimestamp,
      });
    }

    // Pattern 2: Query failures (not finding data)
    if (combined.includes('query') || combined.includes('not found') || combined.includes('empty')) {
      const patternId = createPatternId('failure-mode', 'query-mismatch');
      if (!patterns.has(patternId)) {
        patterns.set(patternId, {
          type: 'failure-mode',
          pattern_id: patternId,
          name: 'query-data-mismatch',
          description: 'Data written but cannot be queried back',
          keywords: ['query', 'not found', 'empty', 'missing'],
          affectedComponents: ['repositories', 'queries'],
          occurrences: 1,
          severity: 'critical',
          resolutions: ['normalize data format before storage', 'ensure query predicates match write format'],
          lastOccurrence: outcome.created_at || deterministicTimestamp,
        });
      } else {
        const p = patterns.get(patternId)!;
        p.occurrences++;
        p.lastOccurrence = outcome.created_at || deterministicTimestamp;
      }
    }

    // Pattern 3: JSON/parsing issues
    if (combined.includes('json') || combined.includes('parse') || combined.includes('stringify')) {
      const patternId = createPatternId('failure-mode', 'json-serialization');
      if (!patterns.has(patternId)) {
        patterns.set(patternId, {
          type: 'failure-mode',
          pattern_id: patternId,
          name: 'json-serialization-error',
          description: 'JSON parsing or stringification fails',
          keywords: ['json', 'parse', 'stringify', 'invalid'],
          affectedComponents: ['event storage', 'content serialization'],
          occurrences: 1,
          severity: 'high',
          resolutions: ['validate JSON before storage', 'handle parsing errors gracefully'],
          lastOccurrence: outcome.created_at || deterministicTimestamp,
        });
      } else {
        const p = patterns.get(patternId)!;
        p.occurrences++;
        p.lastOccurrence = outcome.created_at || deterministicTimestamp;
      }
    }
  }

  return Array.from(patterns.values());
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
 * Detects refactoring/cleanup themes from event patterns
 */
export function detectRefactorThemes(events: ForgeEvent[]): RefactorThemePattern[] {
  const patterns = new Map<string, RefactorThemePattern>();
  const eventTags = tagEvents(events);

  // Check for cleanup events
  const cleanupEvents = events.filter((e) => {
    const tags = eventTags.get(e.event_id) || [];
    return tags.includes('cleanup');
  });

  if (cleanupEvents.length > 0) {
    // Pattern 1: Unused imports cleanup
    const unusedImportEvents = cleanupEvents.filter((e) =>
      e.content.summary.toLowerCase().includes('unused import')
    );
    if (unusedImportEvents.length > 0) {
      const patternId = createPatternId('refactor-theme', 'unused-imports');
      patterns.set(patternId, {
        type: 'refactor-theme',
        pattern_id: patternId,
        name: 'unused-imports-cleanup',
        description: 'Recurring removal of unused import statements',
        affectedModules: extractAffectedModules(unusedImportEvents),
        occurrences: unusedImportEvents.length,
        valueDelivered: 'Reduced code clutter, improved build clarity',
        estimatedEffort: 'low',
        lastOccurrence: unusedImportEvents[unusedImportEvents.length - 1].timestamp,
      });
    }

    // Pattern 2: Dead code removal
    const deadCodeEvents = cleanupEvents.filter((e) =>
      e.content.summary.toLowerCase().includes('dead code') ||
      e.content.summary.toLowerCase().includes('remove')
    );
    if (deadCodeEvents.length > 0) {
      const patternId = createPatternId('refactor-theme', 'dead-code');
      patterns.set(patternId, {
        type: 'refactor-theme',
        pattern_id: patternId,
        name: 'dead-code-removal',
        description: 'Recurring removal of dead or obsolete code',
        affectedModules: extractAffectedModules(deadCodeEvents),
        occurrences: deadCodeEvents.length,
        valueDelivered: 'Reduced maintenance burden, improved focus',
        estimatedEffort: 'medium',
        lastOccurrence: deadCodeEvents[deadCodeEvents.length - 1].timestamp,
      });
    }
  }

  return Array.from(patterns.values());
}

/**
 * Detects recurring architecture decisions
 */
export function detectArchitectureDecisions(
  events: ForgeEvent[],
  taggedEvents: Map<string, EventTag[]>
): ArchitectureDecisionPattern[] {
  const patterns = new Map<string, ArchitectureDecisionPattern>();

  // Pattern 1: Deterministic artifact generation
  const artifactEvents = events.filter((e) => e.event_type === 'artifact_generated');
  const deterministicEvents = artifactEvents.filter((e) => {
    const tags = taggedEvents.get(e.event_id) || [];
    return tags.includes('source-of-truth');
  });

  if (deterministicEvents.length > 0) {
    const patternId = createPatternId('architecture-decision', 'deterministic-artifacts');
    patterns.set(patternId, {
      type: 'architecture-decision',
      pattern_id: patternId,
      name: 'deterministic-artifact-generation',
      principle: 'All artifacts must be deterministically generated from canonical event stream',
      rationale: 'Ensures reproducibility and verifiability of outputs',
      affectedAreas: ['artifact generation', 'ADR generation', 'session summaries'],
      decisions: deterministicEvents.length,
      tradeoffs: ['Requires canonical event stream', 'Cannot use external model output'],
      alternatives: ['Use AI-generated summaries', 'Use cached versioned artifacts'],
      lastDecision: deterministicEvents[deterministicEvents.length - 1].timestamp,
    });
  }

  // Pattern 2: Project-scoped storage
  const routingEvents = events.filter((e) => {
    const tags = taggedEvents.get(e.event_id) || [];
    return tags.includes('artifact-routing');
  });

  if (routingEvents.length > 0) {
    const patternId = createPatternId('architecture-decision', 'project-scoped-storage');
    patterns.set(patternId, {
      type: 'architecture-decision',
      pattern_id: patternId,
      name: 'project-scoped-storage-boundaries',
      principle: 'Each project has its own scoped artifact storage directory',
      rationale: 'Prevents cross-project pollution and enables per-project versioning',
      affectedAreas: ['artifact paths', 'project contexts'],
      decisions: routingEvents.length,
      tradeoffs: ['No global artifact sharing', 'More disk usage multiplied by projects'],
      alternatives: ['Global shared artifact store', 'Cloud-backed storage'],
      lastDecision: routingEvents[routingEvents.length - 1].timestamp,
    });
  }

  return Array.from(patterns.values());
}

/**
 * Detects workflow friction points
 */
export function detectFrictionPoints(events: ForgeEvent[], taggedEvents: Map<string, EventTag[]>): FrictionPointPattern[] {
  const patterns = new Map<string, FrictionPointPattern>();

  // Pattern 1: Schema migration friction
  const migrationEvents = events.filter((e) => {
    const tags = taggedEvents.get(e.event_id) || [];
    return tags.includes('migration');
  });

  if (migrationEvents.length > 0) {
    const patternId = createPatternId('friction-point', 'schema-migration');
    patterns.set(patternId, {
      type: 'friction-point',
      pattern_id: patternId,
      name: 'schema-migration-complexity',
      description: 'Schema changes require coordination across repository layer',
      frequency: migrationEvents.length,
      impactArea: 'Data storage and repository updates',
      symptoms: ['Queries break after schema changes', 'Old code still references old fields'],
      workarounds: ['Careful naming conventions', 'Test suite for migration validation'],
      lastEncountered: migrationEvents[migrationEvents.length - 1].timestamp,
    });
  }

  // Pattern 2: Event routing friction
  const routingEvents = events.filter((e) => e.event_type.includes('dispatch'));
  if (routingEvents.length > 3) {
    const patternId = createPatternId('friction-point', 'dispatch-complexity');
    patterns.set(patternId, {
      type: 'friction-point',
      pattern_id: patternId,
      name: 'dispatch-routing-complexity',
      description: 'Managing dispatch lifecycle and routing adds cognitive load',
      frequency: routingEvents.length,
      impactArea: 'Session and dispatch tracking',
      symptoms: ['Thread ID confusion', 'Dispatch context loss'],
      workarounds: ['Explicit fallback logic', 'Verbose logging at handoff points'],
      lastEncountered: routingEvents[routingEvents.length - 1].timestamp,
    });
  }

  return Array.from(patterns.values());
}

/**
 * Detects recurring acceptance criteria and validation patterns
 */
export function detectAcceptanceCriteria(
  events: ForgeEvent[],
  taggedEvents: Map<string, EventTag[]>
): AcceptanceCriteriaPattern[] {
  const patterns = new Map<string, AcceptanceCriteriaPattern>();

  // Pattern 1: Determinism validation
  const validationEvents = events.filter((e) => {
    const tags = taggedEvents.get(e.event_id) || [];
    return tags.includes('validation');
  });

  if (validationEvents.length > 0) {
    const patternId = createPatternId('acceptance-criteria', 'determinism');
    patterns.set(patternId, {
      type: 'acceptance-criteria',
      pattern_id: patternId,
      name: 'determinism-validation',
      criteria: [
        'Same input events produce same output',
        'No random IDs or timestamps',
        'No external model invocation',
        'Results are reproducible',
      ],
      occurrences: validationEvents.length,
      passingRate: 1.0, // Assume passing if we see validation events
      relatedTags: ['validation', 'source-of-truth'],
      lastValidation: validationEvents[validationEvents.length - 1].timestamp,
    });
  }

  return Array.from(patterns.values());
}

/**
 * Extract affected module names from events
 */
function extractAffectedModules(events: ForgeEvent[]): string[] {
  const modules = new Set<string>();
  for (const event of events) {
    const content = `${event.content.summary} ${event.content.details || ''}`.toLowerCase();
    
    // Common module patterns
    if (content.includes('repository')) modules.add('repository');
    if (content.includes('event')) modules.add('events');
    if (content.includes('artifact')) modules.add('artifacts');
    if (content.includes('session')) modules.add('sessions');
    if (content.includes('dispatch')) modules.add('dispatch');
    if (content.includes('extension')) modules.add('extension');
  }
  return Array.from(modules);
}

/**
 * Run all pattern detection rules
 */
export function detectAllPatterns(
  events: ForgeEvent[],
  outcomes: any[] = []
): DetectedPattern[] {
  const taggedEvents = tagEvents(events);
  const patterns: DetectedPattern[] = [];

  patterns.push(...detectFailureModes(events, outcomes));
  patterns.push(...detectRefactorThemes(events));
  patterns.push(...detectArchitectureDecisions(events, taggedEvents));
  patterns.push(...detectFrictionPoints(events, taggedEvents));
  patterns.push(...detectAcceptanceCriteria(events, taggedEvents));

  return patterns;
}

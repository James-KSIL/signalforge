/**
 * Engineering Insights Generator
 * 
 * Generates a weekly/monthly insights summary that answers:
 * - What kinds of problems were solved this period
 * - What kinds of issues recur
 * - What architectural lessons are emerging
 * - What constraints show up repeatedly
 * - What this suggests about the system and engineering strengths
 * 
 * Output: docs/<project_id>/insights/YYYY-MM-DD_<session-or-range>.md
 */

import { ForgeEvent } from '../events/event.types';
import { DetectedPattern, PatternFrequency } from '../patterns/patternTypes';
import { computePatternFrequencies, identifyPatternRelationships } from '../patterns/patternExtractor';
import { EventTag, tagStatistics } from '../events/eventTags';

/**
 * Insights structure
 */
export interface EngineeringInsights {
  project_id: string;
  period: {
    start: string;
    end: string;
    label: string;
  };
  context: {
    total_events: number;
    total_sessions: number;
    total_dispatches: number;
    total_outcomes: number;
  };
  recurring_themes: {
    theme: string;
    frequency: number;
    evidence: string[];
    impact: string;
    recommendation?: string;
  }[];
  repeated_breakages: {
    pattern: string;
    occurrences: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    resolution_strategy: string;
  }[];
  architecture_lessons: {
    lesson: string;
    why_it_matters: string;
    where_it_applies: string[];
    tradeoff: string;
  }[];
  repeated_constraints: {
    constraint: string;
    reason: string;
    affected_areas: string[];
    adaptation: string;
  }[];
  inferred_strengths: {
    strength: string;
    evidence: string;
    opportunity: string;
  }[];
  system_characteristics: {
    key_characteristic: string;
    supporting_data: string;
  }[];
  next_hardening_priorities: string[];
  data_qualities: Record<string, string>;
  context_window: string[];
  repeated_design_decisions: string[];
  inferred_engineering_strengths: string[];
  source_event_ids: string[];
}

/**
 * Generate engineering insights from patterns and events
 */
export function generateInsights(
  projectId: string,
  events: ForgeEvent[],
  patterns: DetectedPattern[],
  outcomes: any[] = [],
  timeRangeStart?: string,
  timeRangeEnd?: string,
  periodLabel?: string
): EngineeringInsights {
  // Sort events
  const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const deterministicTimestamp = getDeterministicTimestamp(sortedEvents, outcomes);

  // Time range
  const start = timeRangeStart || (sortedEvents[0]?.timestamp) || deterministicTimestamp;
  const end = timeRangeEnd || (sortedEvents[sortedEvents.length - 1]?.timestamp) || deterministicTimestamp;
  const label = periodLabel || extractPeriodLabel(start, end);

  // Count unique entities
  const sessions = new Set(sortedEvents.map((e) => e.session_id).filter(Boolean));
  const dispatches = new Set(sortedEvents.map((e) => e.dispatch_id).filter(Boolean));

  // Analyze patterns
  const frequencies = computePatternFrequencies(patterns);
  const relationships = identifyPatternRelationships(patterns);

  const architectureLessons = analyzeArchitectureLessons(patterns);
  const inferredStrengths = inferEngineeringStrengths(patterns, frequencies, outcomes);
  const sourceEventIds = sortedEvents.map((event) => event.event_id).filter((eventId) => !!eventId);
  const contextWindow = [
    `total_events=${sortedEvents.length}`,
    `total_sessions=${sessions.size}`,
    `total_dispatches=${dispatches.size}`,
    `total_outcomes=${outcomes.length}`,
    `period=${start}..${end}`,
  ];

  return {
    project_id: projectId,
    period: { start, end, label },
    context: {
      total_events: sortedEvents.length,
      total_sessions: sessions.size,
      total_dispatches: dispatches.size,
      total_outcomes: outcomes.length,
    },
    recurring_themes: analyzeRecurringThemes(patterns, frequencies, events),
    repeated_breakages: analyzeRepeatedBreakages(patterns),
    architecture_lessons: architectureLessons,
    repeated_constraints: analyzeRepeatedConstraints(patterns, events),
    inferred_strengths: inferredStrengths,
    system_characteristics: characterizeSystem(patterns, events),
    next_hardening_priorities: recommendHardeningPriorities(patterns, outcomes),
    data_qualities: assessDataQualities(patterns, events, outcomes),
    context_window: contextWindow,
    repeated_design_decisions: architectureLessons.map((lesson) => lesson.lesson),
    inferred_engineering_strengths: inferredStrengths.map((strength) => strength.strength),
    source_event_ids: sourceEventIds,
  };
}

/**
 * Analyze recurring themes across patterns
 */
function analyzeRecurringThemes(
  patterns: DetectedPattern[],
  frequencies: PatternFrequency[],
  events: ForgeEvent[]
): EngineeringInsights['recurring_themes'] {
  const themes: EngineeringInsights['recurring_themes'] = [];

  // Theme 1: Cleanup/maintenance patterns
  const cleanupPatterns = patterns.filter((p) => p.type === 'refactor-theme');
  if (cleanupPatterns.length > 0) {
    themes.push({
      theme: 'Regular maintenance and cleanup activities',
      frequency: cleanupPatterns.length,
      evidence: cleanupPatterns.map((p) => p.name),
      impact: 'Keeps codebase healthy and prevents debt accumulation',
      recommendation: 'Integrate cleanup into sprint planning to stay proactive',
    });
  }

  // Theme 2: Architecture decisions
  const archDecisions = patterns.filter((p) => p.type === 'architecture-decision');
  if (archDecisions.length > 0) {
    themes.push({
      theme: 'Recurring architectural principles and constraints',
      frequency: archDecisions.length,
      evidence: archDecisions.map((p) => (p as any).principle),
      impact: 'Shapes system reliability and maintainability',
      recommendation: 'Document as ADRs to guide future decisions',
    });
  }

  // Theme 3: Validation focus
  const validationEvents = events.filter((e) => {
    return e.content.summary.toLowerCase().includes('validat') ||
           e.content.summary.toLowerCase().includes('test') ||
           e.content.summary.toLowerCase().includes('check');
  });

  if (validationEvents.length > events.length * 0.1) {
    themes.push({
      theme: 'Strong validation and testing culture',
      frequency: validationEvents.length,
      evidence: ['Significant portion of events are validation-related'],
      impact: 'Builds confidence in deliverables',
      recommendation: 'Continue; consider automating determinism checks',
    });
  }

  return themes;
}

/**
 * Analyze repeated failures/breakages
 */
function analyzeRepeatedBreakages(patterns: DetectedPattern[]): EngineeringInsights['repeated_breakages'] {
  const breakages: EngineeringInsights['repeated_breakages'] = [];

  const failurePatterns = patterns.filter((p) => p.type === 'failure-mode') as any[];

  for (const pattern of failurePatterns) {
    breakages.push({
      pattern: pattern.name,
      occurrences: pattern.occurrences || 1,
      severity: pattern.severity || 'medium',
      resolution_strategy: pattern.resolutions?.[0] || 'Under investigation',
    });
  }

  return breakages.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Analyze emerging architecture lessons
 */
function analyzeArchitectureLessons(patterns: DetectedPattern[]): EngineeringInsights['architecture_lessons'] {
  const lessons: EngineeringInsights['architecture_lessons'] = [];

  const archPatterns = patterns.filter((p) => p.type === 'architecture-decision') as any[];

  for (const pattern of archPatterns) {
    lessons.push({
      lesson: pattern.name,
      why_it_matters: pattern.rationale || pattern.principle,
      where_it_applies: pattern.affectedAreas || [],
      tradeoff: pattern.tradeoffs?.[0] || 'None documented',
    });
  }

  return lessons;
}

/**
 * Analyze repeated constraints
 */
function analyzeRepeatedConstraints(
  patterns: DetectedPattern[],
  events: ForgeEvent[]
): EngineeringInsights['repeated_constraints'] {
  const constraints: EngineeringInsights['repeated_constraints'] = [];

  // Constraint 1: Determinism requirement
  const deterministicEvents = events.filter((e) =>
    e.content.summary.toLowerCase().includes('determin')
  );
  if (deterministicEvents.length > 0) {
    constraints.push({
      constraint: 'Deterministic artifact generation from canonical event stream',
      reason: 'Ensures reproducibility and verifiability of system output',
      affected_areas: ['artifact generation', 'validation'],
      adaptation: 'No external model invocation, deterministic rules only',
    });
  }

  // Constraint 2: Project scoping
  const routingEvents = events.filter((e) =>
    e.content.summary.toLowerCase().includes('project') ||
    e.content.summary.toLowerCase().includes('scop')
  );
  if (routingEvents.length > 0) {
    constraints.push({
      constraint: 'Project-scoped storage and artifact boundaries',
      reason: 'Prevents cross-project contamination and enables independent versioning',
      affected_areas: ['storage', 'routing', 'paths'],
      adaptation: 'docs/<project_id>/ directory structure enforced consistently',
    });
  }

  // Constraint 3: Event stream as source of truth
  const eventStreamEvents = events.filter((e) =>
    e.role === 'system' || e.event_type.includes('session')
  );
  if (eventStreamEvents.length > events.length * 0.2) {
    constraints.push({
      constraint: 'Canonical event stream is the sole source of truth',
      reason: 'Enables deterministic replay, audit trail, and pattern extraction',
      affected_areas: ['data persistence', 'artifact generation', 'analysis'],
      adaptation: 'All outcomes, sessions, dispatches emit events before/after state changes',
    });
  }

  return constraints;
}

/**
 * Infer engineering strengths from patterns and outcomes
 */
function inferEngineeringStrengths(
  patterns: DetectedPattern[],
  frequencies: PatternFrequency[],
  outcomes: any[]
): EngineeringInsights['inferred_strengths'] {
  const strengths: EngineeringInsights['inferred_strengths'] = [];

  // Strength 1: Systematic problem-solving
  if (patterns.some((p) => p.type === 'failure-mode')) {
    const resolutions = patterns
      .filter((p) => p.type === 'failure-mode')
      .flatMap((p: any) => p.resolutions || []);
    if (resolutions.length > 0) {
      strengths.push({
        strength: 'Systematic failure diagnosis and resolution',
        evidence: `${patterns.filter((p) => p.type === 'failure-mode').length} failure modes identified with documented resolutions`,
        opportunity: 'Package most common resolutions into utilities or validators',
      });
    }
  }

  // Strength 2: Architectural discipline
  const archPatterns = patterns.filter((p) => p.type === 'architecture-decision');
  if (archPatterns.length > 0) {
    strengths.push({
      strength: 'Disciplined architectural decision-making',
      evidence: `${archPatterns.length} recurring architecture decisions maintained consistently`,
      opportunity: 'Formalize ADR process and create decision template library',
    });
  }

  // Strength 3: Quality focus
  const successOutcomes = outcomes.filter((o) => o.status === 'success');
  if (successOutcomes.length > outcomes.length * 0.6) {
    strengths.push({
      strength: 'High success rate on completed work',
      evidence: `${((successOutcomes.length / outcomes.length) * 100).toFixed(0)}% of outcomes successful`,
      opportunity: 'Document patterns from successful outcomes for team learning',
    });
  }

  // Strength 4: Continuous improvement
  if (patterns.filter((p) => p.type === 'refactor-theme').length > 0) {
    strengths.push({
      strength: 'Proactive refactoring and technical debt management',
      evidence: 'Regular cleanup and refactoring activities detected',
      opportunity: 'Create backlog of refactoring work items based on cleanup patterns',
    });
  }

  return strengths;
}

/**
 * Characterize system based on patterns
 */
function characterizeSystem(
  patterns: DetectedPattern[],
  events: ForgeEvent[]
): EngineeringInsights['system_characteristics'] {
  const characteristics: EngineeringInsights['system_characteristics'] = [];

  const failureModes = patterns.filter((p) => p.type === 'failure-mode');
  const archDecisions = patterns.filter((p) => p.type === 'architecture-decision');
  const frictionPoints = patterns.filter((p) => p.type === 'friction-point');

  characteristics.push({
    key_characteristic: 'Maturity Level',
    supporting_data:
      failureModes.length > 0
        ? 'Production-grade: active failure detection and resolution'
        : 'Early-stage: few documented breakages',
  });

  characteristics.push({
    key_characteristic: 'Complexity Profile',
    supporting_data:
      archDecisions.length > 2
        ? 'System state: Multiple architectural constraints active'
        : 'Simple state: Fewer architectural decisions',
  });

  characteristics.push({
    key_characteristic: 'Workflow Friction',
    supporting_data:
      frictionPoints.length > 1
        ? `System exhibits ${frictionPoints.length} identifiable friction points worth addressing`
        : 'Workflow relatively smooth',
  });

  const migrationEvents = events.filter((e) =>
    e.content.summary.toLowerCase().includes('migrat')
  );
  characteristics.push({
    key_characteristic: 'Evolution State',
    supporting_data:
      migrationEvents.length > 0
        ? 'Active schema/contract evolution in progress'
        : 'Stable schema, no major migrations detected',
  });

  return characteristics;
}

/**
 * Recommend next hardening priorities
 */
function recommendHardeningPriorities(
  patterns: DetectedPattern[],
  outcomes: any[]
): string[] {
  const priorities: string[] = [];

  // Priority 1: High-severity failures
  const criticalFailures = (patterns.filter((p) => p.type === 'failure-mode') as any[]).filter(
    (p) => p.severity === 'critical'
  );
  if (criticalFailures.length > 0) {
    priorities.push(
      `Fix ${criticalFailures.length} critical failure mode(s): ${criticalFailures.map((p) => p.name).join(', ')}`
    );
  }

  // Priority 2: Friction points
  const frictionPoints = patterns.filter((p) => p.type === 'friction-point');
  if (frictionPoints.length > 0) {
    priorities.push(
      `Address ${frictionPoints.length} workflow friction point(s) through automation or refactoring`
    );
  }

  // Priority 3: Test coverage
  const failedOutcomes = outcomes.filter((o) => o.status === 'fail' || o.status === 'failed');
  if (failedOutcomes.length > 0) {
    priorities.push('Add regression tests for the top 3 failure modes');
  }

  // Priority 4: Documentation
  const archDecisions = patterns.filter((p) => p.type === 'architecture-decision');
  if (archDecisions.length > 0) {
    priorities.push(`Document ${archDecisions.length} architecture decisions as formal ADRs`);
  }

  // Priority 5: Refactoring backlog
  const cleanupPatterns = patterns.filter((p) => p.type === 'refactor-theme');
  if (cleanupPatterns.length > 0) {
    priorities.push(`Schedule technical debt reduction: ${cleanupPatterns.length} cleanup themes detected`);
  }

  return priorities.slice(0, 5);
}

/**
 * Assess data quality across events/outcomes
 */
function assessDataQualities(
  patterns: DetectedPattern[],
  events: ForgeEvent[],
  outcomes: any[]
): Record<string, string> {
  const qualities: Record<string, string> = {};

  // Check determinism
  const deterministicEvents = events.filter((e) =>
    e.content.summary.toLowerCase().includes('determini')
  );
  qualities['determinism'] =
    deterministicEvents.length > events.length * 0.05 ? 'Strong' : 'Adequate';

  // Check completeness
  const withDetails = events.filter((e) => e.content.details).length;
  qualities['completeness'] =
    withDetails > events.length * 0.5
      ? 'Comprehensive (detailed events)'
      : 'Basic (summaries only)';

  // Check consistency
  const withStatus = events.filter((e) => e.content.status).length;
  qualities['consistency'] =
    withStatus > events.length * 0.7 ? 'High (status tracking)' : 'Moderate';

  // Check traceability
  const threadedEvents = events.filter((e) => e.thread_id).length;
  qualities['traceability'] =
    threadedEvents === events.length ? 'Perfect (all threaded)' : 'Good';

  // Check outcome correlation
  const outcomesWithDispatch = outcomes.filter((o) => o.dispatch_thread_id).length;
  qualities['outcome-correlation'] =
    outcomesWithDispatch > outcomes.length * 0.7
      ? 'Strong (linked to dispatches)'
      : 'Moderate';

  return qualities;
}

/**
 * Extract period label from timestamps
 */
function extractPeriodLabel(start: string, end: string): string {
  const startDay = start.slice(0, 10);
  const endDay = end.slice(0, 10);
  if (!startDay || !endDay) {
    return 'Period';
  }
  if (startDay === endDay) {
    return startDay;
  }
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `Week of ${startDay}`;
  }
  return start.slice(0, 7);
}

/**
 * Render insights to markdown
 */
export function renderInsightsMarkdown(insights: EngineeringInsights): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Engineering Insights: ${insights.period.label}`);
  lines.push(`**Project**: ${insights.project_id}`);
  lines.push(`**Period**: ${insights.period.start.slice(0, 10)} → ${insights.period.end.slice(0, 10)}`);
  lines.push('');

  // Context
  lines.push('## Context');
  lines.push(`- **Events analyzed**: ${insights.context.total_events}`);
  lines.push(`- **Sessions**: ${insights.context.total_sessions}`);
  lines.push(`- **Dispatches**: ${insights.context.total_dispatches}`);
  lines.push(`- **Outcomes**: ${insights.context.total_outcomes}`);
  lines.push('');

  // Recurring themes
  if (insights.recurring_themes.length > 0) {
    lines.push('## Recurring Themes');
    for (const theme of insights.recurring_themes) {
      lines.push(`### ${theme.theme}`);
      lines.push(`**Frequency**: ${theme.frequency} occurrences`);
      lines.push(`**Evidence**: ${theme.evidence.join(', ')}`);
      lines.push(`**Impact**: ${theme.impact}`);
      if (theme.recommendation) {
        lines.push(`**Recommendation**: ${theme.recommendation}`);
      }
      lines.push('');
    }
  }

  // Breakages
  if (insights.repeated_breakages.length > 0) {
    lines.push('## Repeated Breakages');
    for (const breakage of insights.repeated_breakages) {
      lines.push(
        `- **${breakage.pattern}** (${breakage.severity}): ${breakage.occurrences}x → ${breakage.resolution_strategy}`
      );
    }
    lines.push('');
  }

  // Architecture lessons
  if (insights.architecture_lessons.length > 0) {
    lines.push('## Architecture Lessons');
    for (const lesson of insights.architecture_lessons) {
      lines.push(`### ${lesson.lesson}`);
      lines.push(`**Why it matters**: ${lesson.why_it_matters}`);
      lines.push(`**Applies to**: ${lesson.where_it_applies.join(', ')}`);
      lines.push(`**Tradeoff**: ${lesson.tradeoff}`);
      lines.push('');
    }
  }

  // Constraints
  if (insights.repeated_constraints.length > 0) {
    lines.push('## Repeated Constraints');
    for (const constraint of insights.repeated_constraints) {
      lines.push(`### ${constraint.constraint}`);
      lines.push(`**Reason**: ${constraint.reason}`);
      lines.push(`**Affects**: ${constraint.affected_areas.join(', ')}`);
      lines.push(`**Adaptation**: ${constraint.adaptation}`);
      lines.push('');
    }
  }

  // Strengths
  if (insights.inferred_strengths.length > 0) {
    lines.push('## Inferred Engineering Strengths');
    for (const strength of insights.inferred_strengths) {
      lines.push(`### ${strength.strength}`);
      lines.push(`**Evidence**: ${strength.evidence}`);
      lines.push(`**Opportunity**: ${strength.opportunity}`);
      lines.push('');
    }
  }

  // System characteristics
  if (insights.system_characteristics.length > 0) {
    lines.push('## System Characteristics');
    for (const char of insights.system_characteristics) {
      lines.push(`- **${char.key_characteristic}**: ${char.supporting_data}`);
    }
    lines.push('');
  }

  // Data qualities
  lines.push('## Data Quality Assessment');
  for (const [quality, level] of Object.entries(insights.data_qualities)) {
    lines.push(`- **${quality}**: ${level}`);
  }
  lines.push('');

  // Next priorities
  if (insights.next_hardening_priorities.length > 0) {
    lines.push('## Next Hardening Priorities');
    for (let i = 0; i < insights.next_hardening_priorities.length; i++) {
      lines.push(`${i + 1}. ${insights.next_hardening_priorities[i]}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Generated: ${insights.period.end}*`);

  return lines.join('\n');
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

/**
 * Portfolio Signal Generator
 * 
 * Translates system activity into hirable engineering signal.
 * Outputs: docs/<project_id>/portfolio/YYYY-MM-DD_<range>_signal.md
 * 
 * Reads like:
 * "Here is what was difficult, what changed, what invariant was enforced,
 *  and why that matters."
 */

import { ForgeEvent } from '../events/event.types';
import { DetectedPattern } from '../patterns/patternTypes';

/**
 * Portfolio signal entry
 */
export interface PortfolioSignalEntry {
  title: string;
  problem: string;
  approach: string;
  constraints_handled: string[];
  tradeoffs_made: string[];
  failures_encountered: string[];
  resolution_approach: string;
  platform_relevance: string;
  internal_tooling_relevance: string;
  bullet_points: string[];
  constraints?: string[];
  tradeoffs?: string[];
  failures?: string[];
  resolution?: string;
  interview_bullets?: string[];
}

/**
 * Full portfolio signal summary
 */
export interface PortfolioSignal {
  project_id: string;
  period: {
    start: string;
    end: string;
    label: string;
  };
  summary: string;
  engineering_signals: PortfolioSignalEntry[];
  key_achievements: string[];
  technical_capabilities_demonstrated: string[];
  leadership_indicators: string[];
  system_thinking_indicators: string[];
  interview_narratives: {
    title: string;
    story: string;
    interview_question?: string;
    talking_points: string[];
  }[];
  source_event_ids: string[];
}

/**
 * Generate portfolio signal from events, outcomes, and patterns
 */
export function generatePortfolioSignal(
  projectId: string,
  events: ForgeEvent[],
  patterns: DetectedPattern[],
  outcomes: any[] = [],
  timeRangeStart?: string,
  timeRangeEnd?: string
): PortfolioSignal {
  const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const deterministicTimestamp = getDeterministicTimestamp(sortedEvents, outcomes);

  const start = timeRangeStart || (sortedEvents[0]?.timestamp) || deterministicTimestamp;
  const end = timeRangeEnd || (sortedEvents[sortedEvents.length - 1]?.timestamp) || deterministicTimestamp;
  const label = extractPeriodLabel(start, end);

  // Extract signals from outcomes and patterns
  const signals = extractPortfolioSignals(events, outcomes, patterns);

  // Identify achievements
  const achievements = identifyKeyAchievements(patterns, outcomes);

  // Identify demonstrated capabilities
  const capabilities = identifyTechnicalCapabilities(patterns, events);

  // Identify leadership indicators
  const leadership = identifyLeadershipIndicators(patterns, events);

  // Identify systems thinking
  const systemsThinking = identifySystemsThinking(patterns, events);

  // Create interview narratives
  const narratives = createInterviewNarratives(signals, patterns, outcomes);

  // Generate summary
  const summary = generatePortfolioSummary(signals, achievements, capabilities);

  const normalizedSignals = signals.map((signal) => ({
    ...signal,
    constraints: signal.constraints_handled,
    tradeoffs: signal.tradeoffs_made,
    failures: signal.failures_encountered,
    resolution: signal.resolution_approach,
    interview_bullets: signal.bullet_points,
  }));
  const sourceEventIds = sortedEvents.map((event) => event.event_id).filter((eventId) => !!eventId);

  return {
    project_id: projectId,
    period: { start, end, label },
    summary,
    engineering_signals: normalizedSignals,
    key_achievements: achievements,
    technical_capabilities_demonstrated: capabilities,
    leadership_indicators: leadership,
    system_thinking_indicators: systemsThinking,
    interview_narratives: narratives,
    source_event_ids: sourceEventIds,
  };
}

/**
 * Extract portfolio signals from outcomes, patterns, and events
 */
function extractPortfolioSignals(
  events: ForgeEvent[],
  outcomes: any[],
  patterns: DetectedPattern[]
): PortfolioSignalEntry[] {
  const signals: PortfolioSignalEntry[] = [];

  // Signal 1: Failure mode resolution (if any detected)
  const failureModes = patterns.filter((p) => p.type === 'failure-mode') as any[];
  for (const failureMode of failureModes) {
    signals.push({
      title: `Resolved: ${failureMode.name}`,
      problem: `System exhibited ${failureMode.name} failure mode`,
      approach: `Diagnosed through event stream analysis and implemented deterministic fix`,
      constraints_handled: [
        'Had to maintain canonical event stream integrity',
        'Could not introduce new external dependencies',
        failureMode.severity === 'critical' ? 'Critical priority requiring careful rollout' : 'Required minimal performance impact',
      ],
      tradeoffs_made: [
        'Added normalization logic (performance vs correctness)',
        'Chose explicit fallback handling (verbosity vs robustness)',
      ],
      failures_encountered: failureMode.failures_encountered || [
        `${failureMode.occurrences} production occurrences before resolution`,
      ],
      resolution_approach: failureMode.resolutions?.[0] || 'Applied systematic debugging',
      platform_relevance:
        'Event stream integrity + failure diagnosis patterns are universal across systems',
      internal_tooling_relevance:
        'Demonstrates ability to debug production issues in deterministic data pipelines',
      bullet_points: [
        `Identified & fixed ${failureMode.name} (severity: ${failureMode.severity})`,
        `Occurred ${failureMode.occurrences}x before resolution`,
        `Applied ${failureMode.resolutions?.length || 1} resolution strategies`,
        `Maintained determinism throughout`,
      ],
    });
  }

  // Signal 2: Architecture-driven design
  const archDecisions = patterns.filter((p) => p.type === 'architecture-decision') as any[];
  for (const decision of archDecisions) {
    signals.push({
      title: `Architecture: ${decision.name}`,
      problem: `System needed ${decision.name} to remain scalable and maintainable`,
      approach: decision.principle,
      constraints_handled: [
        'Deterministic output generation required',
        'Project-scoped isolation mandatory',
        'No external service dependencies',
      ],
      tradeoffs_made: decision.tradeoffs || [
        'Chose consistency over external expressiveness',
        'Local computation vs cloud scalability',
      ],
      failures_encountered: [],
      resolution_approach: `Enforced through validation rules and deterministic guarantees`,
      platform_relevance: 'Core architectural principles transferable to any event-based system',
      internal_tooling_relevance:
        'Demonstrates systems design thinking and constraint-aware architecture',
      bullet_points: [
        `Established ${decision.name}`,
        `Applies to ${decision.affectedAreas?.join(', ') || 'core system'}`,
        `${decision.decisions}+ decisions guided by this principle`,
        `Documented rationale and tradeoffs`,
      ],
    });
  }

  // Signal 3: Friction point resolution
  const frictionPoints = patterns.filter((p) => p.type === 'friction-point') as any[];
  for (const friction of frictionPoints) {
    signals.push({
      title: `Addressed: ${friction.name}`,
      problem: `${friction.description}`,
      approach: `Systematic analysis of workflows + targeted automation/refactoring`,
      constraints_handled: [
        'Had to maintain backwards compatibility',
        'Could not disrupt active workflows',
      ],
      tradeoffs_made: [
        'Added cognitive overhead to fix vs deferring the work',
        'Chose immediate resolution for team velocity',
      ],
      failures_encountered: [`Encountered ${friction.frequency} times before addressing`],
      resolution_approach: friction.workarounds?.[0] || 'Applied systematic hardening',
      platform_relevance:
        'Workflow optimization and friction analysis are universally valuable',
      internal_tooling_relevance:
        'Shows ability to identify and eliminate developer friction points',
      bullet_points: [
        `Identified friction point: ${friction.name}`,
        `Affected ${friction.impactArea}`,
        `${friction.frequency} occurrences before resolution`,
        `Implemented ${friction.workarounds?.length || 1} workarounds`,
      ],
    });
  }

  // Signal 4: Data quality and validation
  const validationEvents = events.filter((e) =>
    e.content.summary.toLowerCase().includes('validat') ||
    e.event_type === 'outcome_logged'
  );

  if (validationEvents.length > 0) {
    signals.push({
      title: 'Deterministic Validation Pipeline',
      problem: 'System needed guaranteed reproducibility and auditability',
      approach: 'Built canonical event stream with deterministic generators and continuous validation',
      constraints_handled: [
        'All artifacts must be reproducible from event stream',
        'No external model invocation allowed',
        'Determinism must be provable via testing',
      ],
      tradeoffs_made: [
        'Limited to deterministic patterns vs AI-powered analysis',
        'More verbose validation code for auditability',
      ],
      failures_encountered: [
        `${validationEvents.length} validation checkpoints in place`,
      ],
      resolution_approach: 'Continuous validation framework with event-based testing',
      platform_relevance:
        'Deterministic systems are increasingly important for trustworthy AI and distributed systems',
      internal_tooling_relevance:
        'Demonstrates test-driven architecture and quality-first mindset',
      bullet_points: [
        `${validationEvents.length} validation events logged`,
        'Determinism verified through regression testing',
        'Canonical event stream validated before artifact generation',
        'All generators produce identical output from identical input',
      ],
    });
  }

  return signals;
}

/**
 * Identify key achievements
 */
function identifyKeyAchievements(patterns: DetectedPattern[], outcomes: any[]): string[] {
  const achievements: string[] = [];

  // Achievement 1: Failure mode count
  const failureModes = patterns.filter((p) => p.type === 'failure-mode');
  if (failureModes.length > 0) {
    achievements.push(`Identified and documented ${failureModes.length} failure mode patterns`);
  }

  // Achievement 2: Architecture decisions
  const archDecisions = patterns.filter((p) => p.type === 'architecture-decision');
  if (archDecisions.length > 0) {
    achievements.push(`Established ${archDecisions.length} core architecture principles`);
  }

  // Achievement 3: Success rate
  const successOutcomes = outcomes.filter((o) => o.status === 'success');
  if (successOutcomes.length > 0) {
    const rate = ((successOutcomes.length / outcomes.length) * 100).toFixed(0);
    achievements.push(`${rate}% success rate on delivered outcomes`);
  }

  // Achievement 4: Quality improvements
  const cleanupPatterns = patterns.filter((p) => p.type === 'refactor-theme');
  if (cleanupPatterns.length > 0) {
    achievements.push(
      `${cleanupPatterns.length} proactive cleanup/refactoring initiatives completed`
    );
  }

  // Achievement 5: System hardening
  achievements.push('Maintained deterministic artifact generation under all conditions');

  return achievements;
}

/**
 * Identify demonstrated technical capabilities
 */
function identifyTechnicalCapabilities(patterns: DetectedPattern[], events: ForgeEvent[]): string[] {
  const capabilities: string[] = [];

  // Event stream expertise
  if (events.length > 100) {
    capabilities.push('Large-scale event stream processing and analysis');
  }

  // Debugging and diagnosis
  if (patterns.some((p) => p.type === 'failure-mode')) {
    capabilities.push('Production failure diagnosis and root cause analysis');
  }

  // Architecture
  if (patterns.some((p) => p.type === 'architecture-decision')) {
    capabilities.push('Principled system architecture and constraint-aware design');
  }

  // Refactoring
  if (patterns.some((p) => p.type === 'refactor-theme')) {
    capabilities.push('Proactive technical debt management and refactoring');
  }

  // Data integrity
  const journeyEvents = events.filter((e) => e.role === 'system');
  if (journeyEvents.length > 0) {
    capabilities.push('Canonical data model and source-of-truth implementation');
  }

  // Testing and validation
  const validationEvents = events.filter((e) =>
    e.content.summary.toLowerCase().includes('validat')
  );
  if (validationEvents.length > 0) {
    capabilities.push('Deterministic system validation and reproducibility testing');
  }

  capabilities.push('Systematic pattern recognition and signal extraction');

  return capabilities;
}

/**
 * Identify leadership indicators
 */
function identifyLeadershipIndicators(patterns: DetectedPattern[], events: ForgeEvent[]): string[] {
  const indicators: string[] = [];

  // Strategic thinking
  if (patterns.filter((p) => p.type === 'architecture-decision').length > 2) {
    indicators.push('Strategic architectural planning and principle-driven design');
  }

  // Proactive problem-solving
  if (patterns.filter((p) => p.type === 'friction-point').length > 0) {
    indicators.push('Identifies and addresses workflow friction proactively');
  }

  // Documentation and knowledge capture
  const documentsEvents = events.filter((e) =>
    e.content.summary.toLowerCase().includes('document') ||
    e.content.details?.toLowerCase().includes('adr')
  );
  if (documentsEvents.length > 0 || patterns.some((p) => p.type === 'architecture-decision')) {
    indicators.push('Thorough documentation of decisions and patterns');
  }

  // Quality focus
  const testingEvents = events.filter((e) =>
    e.content.summary.toLowerCase().includes('test')
  );
  if (testingEvents.length > events.length * 0.1) {
    indicators.push('Quality-first mindset with continuous validation');
  }

  // Systemic improvement
  if (patterns.filter((p) => p.type === 'refactor-theme').length > 1) {
    indicators.push('Continuous improvement culture and technical excellence');
  }

  indicators.push('Disciplined approach to system reliability');

  return indicators;
}

/**
 * Identify systems thinking indicators
 */
function identifySystemsThinking(patterns: DetectedPattern[], events: ForgeEvent[]): string[] {
  const indicators: string[] = [];

  // Understands invariants
  if (patterns.some((p) => p.type === 'architecture-decision')) {
    indicators.push('Defines and enforces system invariants and constraints');
  }

  // Sees tradeoffs
  const tradeoffCount = patterns
    .filter((p) => p.type === 'architecture-decision')
    .flatMap((p: any) => p.tradeoffs || []).length;
  if (tradeoffCount > 0) {
    indicators.push(`Recognizes ${tradeoffCount}+ architectural tradeoffs and rationale`);
  }

  // Understands causality
  if (patterns.filter((p) => p.type === 'failure-mode').length > 0) {
    indicators.push('Links effects to root causes through deterministic analysis');
  }

  // Systems-level optimization
  if (patterns.filter((p) => p.type === 'friction-point').length > 0) {
    indicators.push('Optimizes for end-to-end workflow efficiency, not local steps');
  }

  // Understands event flow
  if (events.length > 50) {
    indicators.push('Models complex systems through canonical event stream');
  }

  // Anticipates failure modes
  if (patterns.filter((p) => p.type === 'failure-mode').length > 2) {
    indicators.push('Anticipates and validates against failure modes');
  }

  indicators.push('Thinks in terms of patterns, relationships, and emergent properties');

  return indicators;
}

/**
 * Create interview narratives
 */
function createInterviewNarratives(
  signals: PortfolioSignalEntry[],
  patterns: DetectedPattern[],
  outcomes: any[]
): PortfolioSignal['interview_narratives'] {
  const narratives: PortfolioSignal['interview_narratives'] = [];

  // Narrative 1: Difficult architecture decision
  const archDecisions = patterns.filter((p) => p.type === 'architecture-decision');
  if (archDecisions.length > 0) {
    const decision = archDecisions[0] as any;
    narratives.push({
      title: 'Handling Complex Architectural Trade-offs',
      story: `In building SignalForge, I needed to ensure deterministic artifact generation while working
        within project-scoped isolation boundaries. The challenge was: how do you maintain reproducibility
        across different runs and environments without external dependencies? I chose a canonical event stream
        as the source of truth, with deterministic generators that produce identical output from identical input.
        The tradeoff: this prevents using external AI models for summarization, but the benefit is complete
        auditability and reproducibility—critical for a system designed to capture engineering signal.`,
      interview_question:
        'Can you tell me about a time when you made a difficult technical decision with clear tradeoffs?',
      talking_points: [
        'Identified core constraints: determinism, isolation, auditability',
        'Evaluated alternatives and articulated tradeoffs',
        'Chose principles over convenience',
        'Result: system that is reproducible, auditable, and pattern-extractable',
      ],
    });
  }

  // Narrative 2: Debugging production issue
  const failureModes = patterns.filter((p) => p.type === 'failure-mode') as any[];
  if (failureModes.length > 0) {
    narratives.push({
      title: 'Systematic Failure Diagnosis',
      story: `While running SignalForge sessions, outcomes weren't being found even though they were being
        created. Initial hypothesis: data corruption. Actual issue: thread_id mismatches between where
        outcomes were being written vs where they were being queried. I traced the data flow through
        the canonical event stream, found the inconsistency, and realized: the outcome repository was using
        dispatch_thread_id while events were falling back to session_id. Fix: resolve thread_id once,
        consistently, before any writes. This taught me the power of canonical models—when data flow is
        explicit and centralized, debugging becomes systematic rather than guesswork.`,
      interview_question:
        'Tell me about a bug you debugged that required deep system understanding.',
      talking_points: [
        'Started with observable behavior (missing queries)',
        'Built hypothesis from code inspection',
        'Traced data flow across layers',
        'Found root cause: data format mismatch',
        'Applied fix at source to ensure consistency',
        'Validated through regression tests',
      ],
    });
  }

  // Narrative 3: Proactive improvement
  const cleanupPatterns = patterns.filter((p) => p.type === 'refactor-theme');
  if (cleanupPatterns.length > 0) {
    narratives.push({
      title: 'Proactive Technical Debt Reduction',
      story: `Rather than wait for technical debt to become a crisis, I implemented periodic
        cleanup and refactoring as part of the normal development flow. This included removing
        unused imports, dead code elimination, and simplifying complex functions. The result:
        the codebase stayed healthy and maintainable without disruptive "debt repayment" phases.
        This approach also freed mental energy for new features rather than constant fire-fighting.`,
      interview_question: "How do you approach managing technical debt?",
      talking_points: [
        'Identified recurring cleanup opportunities',
        'Implemented on regular cadence',
        'Reduced cognitive load on team',
        'Maintained code quality proactively',
        'Enabled faster feature development',
      ],
    });
  }

  return narratives;
}

/**
 * Generate portfolio summary
 */
function generatePortfolioSummary(
  signals: PortfolioSignalEntry[],
  achievements: string[],
  capabilities: string[]
): string {
  const lines: string[] = [];

  lines.push('SignalForge represents a full-stack engineering achievement:');
  lines.push('');
  lines.push(
    'I built a deterministic artifact generation system that extracts engineering signal'
  );
  lines.push(
    'from canonical event streams. The system handles complex constraints (determinism,'
  );
  lines.push(
    'isolation, auditability) while providing deep insights into project patterns, failures,'
  );
  lines.push('and architectural decisions.');
  lines.push('');
  lines.push('Key signal: I think in terms of systems—invariants, tradeoffs, constraints—and');
  lines.push(
    'build solutions that scale from correctness at their foundation, not performance shortcuts.'
  );

  return lines.join('\n');
}

/**
 * Extract period label
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
 * Render portfolio signal to markdown
 */
export function renderPortfolioSignalMarkdown(signal: PortfolioSignal): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Engineering Portfolio Signal: ${signal.period.label}`);
  lines.push(`**Project**: ${signal.project_id}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push(signal.summary);
  lines.push('');

  // Key achievements
  lines.push('## Key Achievements');
  for (const achievement of signal.key_achievements) {
    lines.push(`- ${achievement}`);
  }
  lines.push('');

  // Engineering signals
  lines.push('## Engineering Signals');
  for (const sig of signal.engineering_signals) {
    lines.push(`### ${sig.title}`);
    lines.push(`**Problem**: ${sig.problem}`);
    lines.push(`**Approach**: ${sig.approach}`);
    lines.push('');
    lines.push('**Constraints Handled**:');
    for (const c of sig.constraints_handled) {
      lines.push(`  - ${c}`);
    }
    lines.push('');
    lines.push('**Tradeoffs Made**:');
    for (const t of sig.tradeoffs_made) {
      lines.push(`  - ${t}`);
    }
    if (sig.failures_encountered.length > 0) {
      lines.push('**Failures Encountered**:');
      for (const f of sig.failures_encountered) {
        lines.push(`  - ${f}`);
      }
    }
    lines.push(`**Resolution**: ${sig.resolution_approach}`);
    lines.push(`**Platform Relevance**: ${sig.platform_relevance}`);
    lines.push(`**Internal Tooling Relevance**: ${sig.internal_tooling_relevance}`);
    lines.push('');
  }

  // Technical capabilities
  lines.push('## Technical Capabilities Demonstrated');
  for (const cap of signal.technical_capabilities_demonstrated) {
    lines.push(`- ${cap}`);
  }
  lines.push('');

  // Leadership indicators
  lines.push('## Leadership Indicators');
  for (const ind of signal.leadership_indicators) {
    lines.push(`- ${ind}`);
  }
  lines.push('');

  // Systems thinking
  lines.push('## Systems Thinking');
  for (const ind of signal.system_thinking_indicators) {
    lines.push(`- ${ind}`);
  }
  lines.push('');

  // Interview narratives
  if (signal.interview_narratives.length > 0) {
    lines.push('## Interview-Ready Narratives');
    for (const narrative of signal.interview_narratives) {
      lines.push(`### ${narrative.title}`);
      lines.push(narrative.story);
      lines.push('');
      if (narrative.interview_question) {
        lines.push(`**Interview Question**: *${narrative.interview_question}*`);
        lines.push('');
      }
      lines.push('**Talking Points**:');
      for (const point of narrative.talking_points) {
        lines.push(`- ${point}`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`*Generated: ${signal.period.end}*`);

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

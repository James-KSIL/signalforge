"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeTopicsCollections = exports.exportForSocialMedia = exports.renderLinkedInTopicsMarkdown = exports.generateLinkedInTopics = void 0;
const patternExtractor_1 = require("../patterns/patternExtractor");
/**
 * Generate pattern-aware LinkedIn topics from multi-session history
 */
function generateLinkedInTopics(projectId, events, patterns, sessionId, multiSessionSpan) {
    const deterministicTimestamp = getDeterministicTimestamp(events);
    const frequencies = (0, patternExtractor_1.computePatternFrequencies)(patterns);
    const topics = [];
    // Topics derived from patterns (multi-session signal)
    topics.push(...deriveEngineeringLessonTopics(patterns, frequencies));
    topics.push(...deriveBusinessImpactTopics(patterns, frequencies));
    topics.push(...deriveArchitecturalThinkingTopics(patterns));
    // Limit to 5 topics, high-quality only
    const selected = topics
        .filter((t) => t.is_public) // Show only public topics
        .slice(0, 5);
    return {
        generated_at: deterministicTimestamp,
        project_id: projectId,
        session_id: sessionId,
        sessions_analyzed: multiSessionSpan?.sessions || 1,
        periods_covered: multiSessionSpan?.dateRange || 'current session',
        topics: selected,
    };
}
exports.generateLinkedInTopics = generateLinkedInTopics;
/**
 * Derive engineering lesson topics from patterns
 */
function deriveEngineeringLessonTopics(patterns, frequencies) {
    const topics = [];
    // Lesson 1: Determinism as foundation
    if (patterns.some((p) => p.type === 'architecture-decision')) {
        const archDecisions = patterns.filter((p) => p.type === 'architecture-decision');
        const hasDeterminism = archDecisions.some((p) => p.principle?.toLowerCase().includes('determini') ||
            p.name.toLowerCase().includes('determini'));
        if (hasDeterminism || patterns.length > 3) {
            topics.push({
                title: 'Building Deterministic Systems in Production',
                category: 'engineering_lesson',
                narrative: `Spent the last sprint hardening artifact generation. Core insight: determinism is not 
        a nice-to-have, it's foundational for trustworthy systems. When every output is reproducible from 
        identical input, you can reason about your system with math, not hope. Trade-off: can't use 
        external models for "better" output. Benefit: auditability and reproducibility at scale.`,
                hashtags: ['systems-engineering', 'determinism', 'production-hardening', 'software-reliability'],
                call_to_action: 'What tradeoffs has your team made for determinism vs convenience?',
                is_public: true,
                source_pattern_ids: archDecisions.map((decision) => decision.pattern_id).filter((id) => !!id),
            });
        }
    }
    // Lesson 2: Pattern-driven debugging
    const failureModes = patterns.filter((p) => p.type === 'failure-mode');
    if (failureModes.length > 0) {
        const topFailure = failureModes.sort((a, b) => (b.occurrences || 0) - (a.occurrences || 0))[0];
        topics.push({
            title: 'Systematic Failure Analysis Through Event Streams',
            category: 'engineering_lesson',
            narrative: `Had a recurring issue where queries silently failed due to data format mismatches.
        Root cause: thread_id wasn't normalized before write. Fix: deterministic resolution logic
        applied once, consistently. Lesson: canonical event streams make failure patterns visible
        and reproducible. No more "works on my machine" mysteries.`,
            hashtags: [
                'debugging',
                'root-cause-analysis',
                'event-driven',
                'data-integrity',
            ],
            is_public: true,
            source_pattern_ids: [topFailure.pattern_id].filter((id) => !!id),
        });
    }
    // Lesson 3: Proactive maintenance as signal of health
    const cleanupPatterns = patterns.filter((p) => p.type === 'refactor-theme');
    if (cleanupPatterns.length > 1) {
        topics.push({
            title: 'Technical Debt Is Signal, Not Noise',
            category: 'engineering_lesson',
            narrative: `Noticed recurring cleanup patterns across sessions—unused imports, dead code,
        schema simplifications. Rather than ignore as "housekeeping," treated them as signal:
        the system is evolving. Lesson: proactive refactoring keeps cognitive load down and
        velocity up. Debt isn't removed "later"—it's managed continuously.`,
            hashtags: [
                'technical-debt',
                'code-quality',
                'continuous-improvement',
                'maintainability',
            ],
            call_to_action: 'What cleanup patterns are you seeing in your codebase?',
            is_public: true,
            source_pattern_ids: cleanupPatterns.map((pattern) => pattern.pattern_id).filter((id) => !!id),
        });
    }
    return topics.slice(0, 2); // Max 2 engineering lessons
}
/**
 * Derive business/operational impact topics
 */
function deriveBusinessImpactTopics(patterns, frequencies) {
    const topics = [];
    // Impact 1: Reproducibility = trust
    if (patterns.some((p) => p.type === 'architecture-decision' &&
        (p.principle?.toLowerCase().includes('canon') ||
            p.principle?.toLowerCase().includes('source')))) {
        topics.push({
            title: 'Reproducible Systems Build Trust',
            category: 'business_angle',
            narrative: `Invested in canonical event stream architecture. Result: every artifact generated
        is verifiable and reproducible. Business impact: stakeholders can audit decisions, trace
        outcomes, and trust the analysis. In regulated environments, this is table stakes.
        In all environments, users deserve transparency.`,
            hashtags: ['trust', 'auditability', 'transparency', 'governance'],
            call_to_action: 'How does your team build trust into complex systems?',
            is_public: true,
            source_pattern_ids: patterns.map((pattern) => pattern.pattern_id).filter((id) => !!id),
        });
    }
    // Impact 2: Proactive problem detection
    const failureModes = patterns.filter((p) => p.type === 'failure-mode');
    if (failureModes.length > 0) {
        topics.push({
            title: 'Detecting Patterns Before They Become Crises',
            category: 'business_angle',
            narrative: `Built pattern extraction on top of canonical event stream. Now we can see which
        failure modes repeat, which decisions are recurring, which friction points slow teams down.
        Business impact: turn reactive firefighting into proactive hardening. Know your system's
        true operating envelope before users hit it.`,
            hashtags: [
                'observability',
                'risk-management',
                'operational-excellence',
                'systems-thinking',
            ],
            is_public: true,
            source_pattern_ids: failureModes.map((pattern) => pattern.pattern_id).filter((id) => !!id),
        });
    }
    return topics.slice(0, 2); // Max 2 business topics
}
/**
 * Derive architectural thinking topics
 */
function deriveArchitecturalThinkingTopics(patterns) {
    const topics = [];
    const archDecisions = patterns.filter((p) => p.type === 'architecture-decision');
    if (archDecisions.length > 0) {
        // Pick most interesting architectural decision
        const decision = archDecisions[0];
        topics.push({
            title: `Architecture Principle: ${decision.name}`,
            category: 'business_angle',
            narrative: `Core principle we're enforcing: ${decision.principle}. Why? ${decision.rationale}.
        Tradeoff: ${decision.tradeoffs?.[0] || 'significant upfront investment'}. Applies to:
        ${decision.affectedAreas?.join(', ') || 'core system'}. Architectural principles aren't
        constraints you fight—they're the guardrails that let systems scale.`,
            hashtags: [
                'systems-architecture',
                'design-principles',
                'scalability',
                'software-engineering',
            ],
            is_public: true,
            source_pattern_ids: [decision.pattern_id].filter((id) => !!id),
        });
    }
    // Topic: Constraints as clarity
    if (archDecisions.length > 1) {
        topics.push({
            title: 'Constraints Create Clarity',
            category: 'business_angle',
            narrative: `Building SignalForge, I deliberately chose constraints: determinism, local-only,
        project-scoped. Each constraint eliminated a class of "easy" solutions but forced better
        design. Benefit: the system is simpler to reason about. Constraint-driven design often
        beats freedom-based design. Limits force clarity.`,
            hashtags: [
                'design-thinking',
                'systems-engineering',
                'constraints',
                'clarity',
            ],
            is_public: true,
            source_pattern_ids: archDecisions.map((decision) => decision.pattern_id).filter((id) => !!id),
        });
    }
    return topics.slice(0, 1); // Max 1 architecture topic
}
/**
 * Serialize topics collection to markdown
 */
function renderLinkedInTopicsMarkdown(collection) {
    const lines = [];
    lines.push('# LinkedIn Topic Suggestions');
    lines.push('');
    lines.push(`Generated: ${collection.generated_at.slice(0, 10)} | ${collection.sessions_analyzed} session(s)`);
    lines.push(`Period: ${collection.periods_covered}`);
    lines.push('');
    lines.push('## Topics Available for Sharing');
    lines.push('');
    for (let i = 0; i < collection.topics.length; i++) {
        const topic = collection.topics[i];
        lines.push(`### ${i + 1}. ${topic.title}`);
        lines.push(`**Category**: ${topic.category}`);
        lines.push('');
        lines.push(topic.narrative);
        lines.push('');
        lines.push(`**Hashtags**: ${topic.hashtags.map((h) => `#${h}`).join(' ')}`);
        if (topic.call_to_action) {
            lines.push(`**Question for Your Network**: ${topic.call_to_action}`);
        }
        lines.push(`**Status**: ${topic.is_public ? '✅ Ready to share' : '🔒 Internal only'}`);
        lines.push('');
    }
    lines.push('---');
    lines.push(`*${collection.topics.filter((t) => t.is_public).length} topics ready to share*`);
    lines.push(`*Generated from ${collection.sessions_analyzed} session(s)*`);
    return lines.join('\n');
}
exports.renderLinkedInTopicsMarkdown = renderLinkedInTopicsMarkdown;
/**
 * Export topics for social media
 */
function exportForSocialMedia(topic) {
    const maxLength = 300; // Conservative length for most platforms
    const narrative = topic.narrative.replace(/\n\s+/g, ' ').trim();
    const truncated = narrative.length > maxLength ? narrative.slice(0, maxLength - 3) + '...' : narrative;
    return {
        text: `${topic.title}\n\n${truncated}${topic.call_to_action ? `\n\n→ ${topic.call_to_action}` : ''}`,
        hashtags: topic.hashtags.map((h) => `#${h}`).join(' '),
    };
}
exports.exportForSocialMedia = exportForSocialMedia;
/**
 * Merge topics from multiple sources (maintain deduplication)
 */
function mergeTopicsCollections(collections) {
    const allTopics = collections.flatMap((c) => c.topics);
    const uniqueTopics = Array.from(new Map(allTopics.map((t) => [t.title, t])).values());
    const totalSessions = collections.reduce((sum, c) => sum + c.sessions_analyzed, 0);
    const deterministicTimestamp = collections
        .map((c) => c.generated_at)
        .filter((ts) => typeof ts === 'string' && ts.length > 0)
        .sort()
        .slice(-1)[0] || '1970-01-01T00:00:00.000Z';
    return {
        generated_at: deterministicTimestamp,
        project_id: collections[0]?.project_id || 'unknown',
        sessions_analyzed: totalSessions,
        periods_covered: 'multiple periods aggregated',
        topics: uniqueTopics.slice(0, 5),
    };
}
exports.mergeTopicsCollections = mergeTopicsCollections;
function getDeterministicTimestamp(events) {
    if (events.length === 0) {
        return '1970-01-01T00:00:00.000Z';
    }
    const sorted = [...events]
        .map((event) => event.timestamp)
        .filter((timestamp) => typeof timestamp === 'string' && timestamp.length > 0)
        .sort();
    return sorted[sorted.length - 1] || '1970-01-01T00:00:00.000Z';
}

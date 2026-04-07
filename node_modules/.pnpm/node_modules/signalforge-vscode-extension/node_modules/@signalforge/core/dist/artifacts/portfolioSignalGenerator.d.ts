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
export declare function generatePortfolioSignal(projectId: string, events: ForgeEvent[], patterns: DetectedPattern[], outcomes?: any[], timeRangeStart?: string, timeRangeEnd?: string): PortfolioSignal;
/**
 * Render portfolio signal to markdown
 */
export declare function renderPortfolioSignalMarkdown(signal: PortfolioSignal): string;

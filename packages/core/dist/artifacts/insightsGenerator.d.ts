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
import { DetectedPattern } from '../patterns/patternTypes';
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
export declare function generateInsights(projectId: string, events: ForgeEvent[], patterns: DetectedPattern[], outcomes?: any[], timeRangeStart?: string, timeRangeEnd?: string, periodLabel?: string): EngineeringInsights;
/**
 * Render insights to markdown
 */
export declare function renderInsightsMarkdown(insights: EngineeringInsights): string;

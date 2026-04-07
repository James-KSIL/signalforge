/**
 * Core Binding Types
 *
 * Type definitions used by core binding logic
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
import { AuthoritySource, PinMode, ProjectCandidate, CopyBindingEvent, BoundArtifactEvent, AuthorityResolutionResult } from '@signalforge/shared/dist/types/binding';
/**
 * Re-export all shared binding types for convenience
 */
export type { AuthoritySource, PinMode, ProjectCandidate, CopyBindingEvent, BoundArtifactEvent, AuthorityResolutionResult, };
/**
 * Authority with confidence metadata
 *
 * Used internally by core to track confidence in authority resolution
 */
export interface AuthorityWithConfidence {
    authority: AuthoritySource;
    confidence: number;
    reason: string;
    caveats?: string[];
}
/**
 * Binding context
 *
 * Complete context needed to bind an artifact
 */
export interface BindingContext {
    chatId: string;
    copiedText: string;
    selectionType: 'manual' | 'canvas';
    sourceUrl: string;
    resolvedAuthorities: AuthorityWithConfidence[];
    selectedProject: ProjectCandidate;
    boundAt: string;
    bindingDurationMs: number;
}
/**
 * Binding policy
 *
 * Configuration for binding behavior
 */
export interface BindingPolicy {
    tempPinTtlMinutes: number;
    maxPendingBindings: number;
    pendingBindingTtlMinutes: number;
    requireConfirmationForManual: boolean;
    allowRecentProjectBinding: boolean;
}
/**
 * Default binding policy
 */
export declare const DEFAULT_BINDING_POLICY: BindingPolicy;

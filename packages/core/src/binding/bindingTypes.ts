/**
 * Core Binding Types
 * 
 * Type definitions used by core binding logic
 * 
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */

import {
  AuthoritySource,
  PinMode,
  ProjectCandidate,
  CopyBindingEvent,
  BoundArtifactEvent,
  AuthorityResolutionResult,
} from '@signalforge/shared/dist/types/binding';

/**
 * Re-export all shared binding types for convenience
 */
export type {
  AuthoritySource,
  PinMode,
  ProjectCandidate,
  CopyBindingEvent,
  BoundArtifactEvent,
  AuthorityResolutionResult,
};

/**
 * Authority with confidence metadata
 * 
 * Used internally by core to track confidence in authority resolution
 */
export interface AuthorityWithConfidence {
  // The authority source
  authority: AuthoritySource;

  // Confidence 0-1 (1 = highest)
  confidence: number;

  // Reason for this confidence level
  reason: string;

  // Any caveats
  caveats?: string[];
}

/**
 * Binding context
 * 
 * Complete context needed to bind an artifact
 */
export interface BindingContext {
  // Copy event metadata
  chatId: string;
  copiedText: string;
  selectionType: 'manual' | 'canvas';
  sourceUrl: string;

  // Authority resolution
  resolvedAuthorities: AuthorityWithConfidence[];

  // Selected project
  selectedProject: ProjectCandidate;

  // Binding metadata
  boundAt: string;
  bindingDurationMs: number;
}

/**
 * Binding policy
 * 
 * Configuration for binding behavior
 */
export interface BindingPolicy {
  // Default TTL for temporary pins (minutes)
  tempPinTtlMinutes: number;

  // Maximum pending bindings to store
  maxPendingBindings: number;

  // TTL for pending bindings before cleanup (minutes)
  pendingBindingTtlMinutes: number;

  // Whether to require confirmation for manual selections
  requireConfirmationForManual: boolean;

  // Whether to allow binding to recently used projects
  allowRecentProjectBinding: boolean;
}

/**
 * Default binding policy
 */
export const DEFAULT_BINDING_POLICY: BindingPolicy = {
  tempPinTtlMinutes: 30,
  maxPendingBindings: 100,
  pendingBindingTtlMinutes: 30,
  requireConfirmationForManual: true,
  allowRecentProjectBinding: true,
};

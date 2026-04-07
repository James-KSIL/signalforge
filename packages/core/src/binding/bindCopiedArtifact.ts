/**
 * Bind Copied Artifact
 * 
 * Core binding logic that persists BoundArtifactEvent to event stream.
 * 
 * This is the moment where a copied artifact becomes project-owned.
 * 
 * Responsibilities:
 * - Accept CopyBindingEvent and user selection
 * - Create BoundArtifactEvent with full context
 * - Emit event to canonical event/ledger stream
 * - Record for audit trail
 * 
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */

import type { BoundArtifactEvent, ProjectCandidate } from '@signalforge/shared/dist/types/binding';

/**
 * Event emitter interface
 * 
 * Implemented by core event stream/ledger
 */
export interface EventEmitter {
  /**
   * Emit artifact bound event to canonical stream
   * 
   * @param event Bound artifact event
   * @returns Promise that resolves when event is persisted
   */
  emit(event: BoundArtifactEvent): Promise<void>;
}

/**
 * Bind a copied artifact to a project
 * 
 * This function:
 * 1. Creates BoundArtifactEvent from copy context + selection
 * 2. Emits event to canonical ledger
 * 3. Records for audit trail
 * 
 * Only this function may establish project identity binding.
 * 
 * @param params Binding parameters
 * @returns The bound artifact event created
 */
export async function bindCopiedArtifact(params: {
  // Original copy event from ChatGPT
  chatId: string;
  copiedText: string;
  selectionType: 'manual' | 'canvas';
  sourceUrl: string;
  copiedAt: string;

  // Project selection
  selectedProject: ProjectCandidate;

  // Event emitter (injected)
  eventEmitter: EventEmitter;

  // Optional: analytics callback
  onAnalytics?: (event: BoundArtifactEvent) => void;
}): Promise<BoundArtifactEvent> {
  // Create bound artifact event
  // This captures the moment where copy becomes binding
  const boundEvent: BoundArtifactEvent = {
    type: 'artifact_bound',
    chat_id: params.chatId,
    project_id: params.selectedProject.project_id,
    authority: params.selectedProject.authority,
    copied_text: params.copiedText,
    selection_type: params.selectionType,
    source_url: params.sourceUrl,
    created_at: new Date().toISOString(),
  };

  // Emit to canonical ledger
  // This is the irreversible moment of binding
  await params.eventEmitter.emit(boundEvent);

  // Optional: send to analytics
  if (params.onAnalytics) {
    params.onAnalytics(boundEvent);
  }

  return boundEvent;
}

/**
 * Binding operation result
 * 
 * Returned after successful binding
 */
export interface BindingResult {
  // Operation status
  success: boolean;

  // The bound event
  event: BoundArtifactEvent;

  // Optional error message
  error?: string;

  // Timestamp of binding
  boundAt: string;

  // Authority source used
  authority: string;

  // Project ID bound to
  projectId: string;
}

/**
 * Safely bind artifact with error handling
 * 
 * Wraps bindCopiedArtifact with error handling and result normalization
 * 
 * @param params Binding parameters
 * @returns Binding result with status
 */
export async function bindArtifactSafely(params: {
  chatId: string;
  copiedText: string;
  selectionType: 'manual' | 'canvas';
  sourceUrl: string;
  copiedAt: string;
  selectedProject: ProjectCandidate;
  eventEmitter: EventEmitter;
  onAnalytics?: (event: BoundArtifactEvent) => void;
}): Promise<BindingResult> {
  try {
    const event = await bindCopiedArtifact({
      chatId: params.chatId,
      copiedText: params.copiedText,
      selectionType: params.selectionType,
      sourceUrl: params.sourceUrl,
      copiedAt: params.copiedAt,
      selectedProject: params.selectedProject,
      eventEmitter: params.eventEmitter,
      onAnalytics: params.onAnalytics,
    });

    return {
      success: true,
      event,
      boundAt: event.created_at,
      authority: event.authority,
      projectId: event.project_id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[bindArtifactSafely] Error binding artifact:', error);

    return {
      success: false,
      event: undefined as any, // Type assertion for error case
      error: errorMessage,
      boundAt: new Date().toISOString(),
      authority: params.selectedProject.authority,
      projectId: params.selectedProject.project_id,
    };
  }
}

/**
 * Validate binding parameters before persistence
 * 
 * Ensures all required data is present and valid
 * 
 * @param params Parameters to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateBindingParams(params: {
  chatId?: string;
  copiedText?: string;
  selectedProject?: ProjectCandidate;
  eventEmitter?: EventEmitter;
}): string[] {
  const errors: string[] = [];

  if (!params.chatId || params.chatId.trim().length === 0) {
    errors.push('Chat ID is required');
  }

  if (!params.copiedText || params.copiedText.trim().length === 0) {
    errors.push('Copied text cannot be empty');
  }

  if (!params.selectedProject) {
    errors.push('Selected project is required');
  }

  if (!params.selectedProject?.project_id) {
    errors.push('Project ID is required');
  }

  if (!params.eventEmitter) {
    errors.push('Event emitter is required');
  }

  return errors;
}

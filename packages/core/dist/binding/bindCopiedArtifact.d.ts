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
export declare function bindCopiedArtifact(params: {
    chatId: string;
    copiedText: string;
    selectionType: 'manual' | 'canvas';
    sourceUrl: string;
    copiedAt: string;
    selectedProject: ProjectCandidate;
    eventEmitter: EventEmitter;
    onAnalytics?: (event: BoundArtifactEvent) => void;
}): Promise<BoundArtifactEvent>;
/**
 * Binding operation result
 *
 * Returned after successful binding
 */
export interface BindingResult {
    success: boolean;
    event: BoundArtifactEvent;
    error?: string;
    boundAt: string;
    authority: string;
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
export declare function bindArtifactSafely(params: {
    chatId: string;
    copiedText: string;
    selectionType: 'manual' | 'canvas';
    sourceUrl: string;
    copiedAt: string;
    selectedProject: ProjectCandidate;
    eventEmitter: EventEmitter;
    onAnalytics?: (event: BoundArtifactEvent) => void;
}): Promise<BindingResult>;
/**
 * Validate binding parameters before persistence
 *
 * Ensures all required data is present and valid
 *
 * @param params Parameters to validate
 * @returns Array of validation errors (empty if valid)
 */
export declare function validateBindingParams(params: {
    chatId?: string;
    copiedText?: string;
    selectedProject?: ProjectCandidate;
    eventEmitter?: EventEmitter;
}): string[];

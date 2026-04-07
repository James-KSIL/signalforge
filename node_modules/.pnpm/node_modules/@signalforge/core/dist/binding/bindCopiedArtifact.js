"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBindingParams = exports.bindArtifactSafely = exports.bindCopiedArtifact = void 0;
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
async function bindCopiedArtifact(params) {
    // Create bound artifact event
    // This captures the moment where copy becomes binding
    const boundEvent = {
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
exports.bindCopiedArtifact = bindCopiedArtifact;
/**
 * Safely bind artifact with error handling
 *
 * Wraps bindCopiedArtifact with error handling and result normalization
 *
 * @param params Binding parameters
 * @returns Binding result with status
 */
async function bindArtifactSafely(params) {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[bindArtifactSafely] Error binding artifact:', error);
        return {
            success: false,
            event: undefined,
            error: errorMessage,
            boundAt: new Date().toISOString(),
            authority: params.selectedProject.authority,
            projectId: params.selectedProject.project_id,
        };
    }
}
exports.bindArtifactSafely = bindArtifactSafely;
/**
 * Validate binding parameters before persistence
 *
 * Ensures all required data is present and valid
 *
 * @param params Parameters to validate
 * @returns Array of validation errors (empty if valid)
 */
function validateBindingParams(params) {
    const errors = [];
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
exports.validateBindingParams = validateBindingParams;

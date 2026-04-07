/**
 * Browser Extension Binding State
 *
 * Manages binding state in the background service worker.
 *
 * Responsibilities:
 * - Receive copy_binding_requested events from content script
 * - Query VS Code for project context (pin state, active workspace)
 * - Store pending binding state
 * - Coordinate with binding overlay
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
type PinState = {
    project_id: string;
    workspace_root: string;
    expires_at?: string;
};
type CopyBindingEvent = {
    chat_id: string;
    copied_text: string;
    selection_type: string;
    source_url: string;
    created_at: string;
};
type ProjectCandidate = {
    project_id: string;
    label?: string;
    authority: 'pinned_project' | 'manual_selection' | 'active_workspace' | 'recent_project';
    workspace_root?: string;
    expires_at?: string;
};
type BoundArtifactEvent = {
    type: 'artifact_bound';
    chat_id: string;
    project_id: string;
    authority: ProjectCandidate['authority'];
    copied_text: string;
    selection_type: string;
    source_url: string;
    created_at: string;
};
export interface PendingBinding {
    copyEvent: CopyBindingEvent;
    candidates: ProjectCandidate[];
    preselectedProject?: ProjectCandidate;
    hasExpired: boolean;
    expirationNotice?: string;
    createdAt: string;
    reason: string;
}
export declare class BindingState {
    private pendingBindings;
    private readonly readyPromise;
    private vscodeContext;
    constructor();
    whenReady(): Promise<void>;
    private getStorageArea;
    private restorePendingBindings;
    private persistPendingBindings;
    /**
     * Store copy event and create pending binding
     *
     * @param copyEvent Event from content script
     * @param candidates Ordered candidates from authority resolver
     * @param preselected Preselected candidate
     * @param options Optional configuration
     */
    storePendingBinding(copyEvent: CopyBindingEvent, candidates: ProjectCandidate[], preselected: ProjectCandidate | undefined, options?: {
        hasExpired?: boolean;
        expirationNotice?: string;
    }): PendingBinding;
    /**
     * Get pending binding for a chat
     *
     * @param chatId Chat ID to look up
     * @returns Pending binding or undefined
     */
    getPendingBinding(chatId: string): PendingBinding | undefined;
    /**
     * Clear pending binding (after user confirms)
     *
     * @param chatId Chat ID to clear
     */
    clearPendingBinding(chatId: string): void;
    /**
     * Store VS Code context
     *
     * Called when VS Code notifies us of project state
     *
     * @param context VS Code context
     */
    updateVSCodeContext(context: {
        activeWorkspace?: {
            project_id: string;
            workspace_root: string;
        };
        pinnedProject?: PinState;
        recentProject?: {
            project_id: string;
            workspace_root: string;
        };
    }): void;
    /**
     * Get current VS Code context
     *
     * @returns Current context
     */
    getVSCodeContext(): {
        activeWorkspace?: {
            project_id: string;
            workspace_root: string;
        } | undefined;
        pinnedProject?: PinState | undefined;
        recentProject?: {
            project_id: string;
            workspace_root: string;
        } | undefined;
        lastUpdated: string;
    };
    /**
     * Create bound artifact event from pending binding + user selection
     *
     * @param pendingBinding The pending binding
     * @param selectedProject Project user selected
     * @returns Bound artifact event
     */
    createBoundArtifactEvent(pendingBinding: PendingBinding, selectedProject: ProjectCandidate): BoundArtifactEvent;
    /**
     * Build reason string for binding overlay
     *
     * Explains why this binding flow was triggered
     *
     * @param preselected Preselected project
     * @param hasExpired Whether pin expired
     * @returns Reason string
     */
    private buildReason;
    /**
     * Cleanup old pending bindings
     *
     * Removes bindings older than ttlMinutes
     *
     * @param ttlMinutes Time to live in minutes
     */
    cleanupStaleBindings(ttlMinutes?: number): void;
    /**
     * Get all pending bindings (for debugging)
     *
     * @returns Map of pending bindings
     */
    getAllPendingBindings(): Map<string, PendingBinding>;
}
export {};

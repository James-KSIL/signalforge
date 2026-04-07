/**
 * Project Identity Binding Types
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 *
 * These types define the contract for binding copied artifacts to project identity
 * through explicit authority resolution, never inference.
 */
/**
 * Source of project authority in the binding decision
 *
 * Priority order (explicit):
 * 1. pinned_project - user explicitly pinned a project
 * 2. active_workspace - inferred from VS Code active editor
 * 3. recent_project - historical context from recent work
 * 4. manual_selection - user manually chose in UI
 */
export type AuthoritySource = 'pinned_project' | 'active_workspace' | 'recent_project' | 'manual_selection';
/**
 * Pin mode for temporary vs persistent project binding
 */
export type PinMode = 'temporary' | 'persistent';
/**
 * A candidate project that may be bound to a copied artifact
 *
 * Always includes authority source for transparency at UI layer
 */
export interface ProjectCandidate {
    project_id: string;
    label: string;
    authority: AuthoritySource;
    workspace_root?: string;
    expires_at?: string | null;
}
/**
 * Event emitted when user initiates copy from ChatGPT
 *
 * This marks the beginning of the binding flow.
 * No project determination yet — only raw copy event.
 */
export interface CopyBindingEvent {
    type: 'copy_binding_requested';
    chat_id: string;
    copied_text: string;
    selection_type: 'manual' | 'canvas';
    source_url: string;
    created_at: string;
}
/**
 * Event emitted when copied artifact is bound to a project
 *
 * This is the moment where a copied artifact becomes project-owned.
 * Only binding at copy time establishes project identity.
 */
export interface BoundArtifactEvent {
    type: 'artifact_bound';
    chat_id: string;
    project_id: string;
    authority: AuthoritySource;
    copied_text: string;
    selection_type: 'manual' | 'canvas';
    source_url: string;
    created_at: string;
}
/**
 * Pin state stored in VS Code extension
 *
 * Tracks project pin: temporary (TTL) or persistent
 */
export interface PinState {
    project_id: string;
    workspace_root: string;
    mode: PinMode;
    pinned_at: string;
    expires_at?: string | null;
}
/**
 * Authority resolution result
 *
 * Ordered list of project candidates with their authority sources
 * Never includes hidden authority — all sources are explicit
 */
export interface AuthorityResolutionResult {
    candidates: ProjectCandidate[];
    preselected?: ProjectCandidate;
    has_expired?: boolean;
    expiration_notice?: string;
}

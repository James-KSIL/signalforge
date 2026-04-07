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
export type AuthoritySource =
  | 'pinned_project'
  | 'active_workspace'
  | 'recent_project'
  | 'manual_selection';

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
  // Unique project identifier
  project_id: string;

  // Display label for user
  label: string;

  // Why this project is a candidate
  authority: AuthoritySource;

  // VS Code workspace root (if available)
  workspace_root?: string;

  // When this candidate stops being valid (for temporary pins)
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

  // ChatGPT conversation ID
  chat_id: string;

  // Raw artifact text copied to clipboard
  copied_text: string;

  // How artifact was selected: direct copy or canvas copy button
  selection_type: 'manual' | 'canvas';

  // Source URL where copy occurred (for audit)
  source_url: string;

  // ISO timestamp
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

  // ChatGPT conversation ID
  chat_id: string;

  // Project that owns this artifact
  project_id: string;

  // Why this project was chosen (authority source)
  authority: AuthoritySource;

  // Original artifact text
  copied_text: string;

  // How artifact was selected
  selection_type: 'manual' | 'canvas';

  // Source URL
  source_url: string;

  // ISO timestamp
  created_at: string;
}

/**
 * Pin state stored in VS Code extension
 * 
 * Tracks project pin: temporary (TTL) or persistent
 */
export interface PinState {
  // Pinned project ID
  project_id: string;

  // VS Code workspace root of pinned project
  workspace_root: string;

  // Temporary or persistent pin
  mode: PinMode;

  // When pin was created (ISO timestamp)
  pinned_at: string;

  // When pin expires (ISO timestamp, or null for persistent)
  expires_at?: string | null;
}

/**
 * Authority resolution result
 * 
 * Ordered list of project candidates with their authority sources
 * Never includes hidden authority — all sources are explicit
 */
export interface AuthorityResolutionResult {
  // Ordered candidates (highest priority first)
  candidates: ProjectCandidate[];

  // Preselected candidate (first valid one from priority order)
  preselected?: ProjectCandidate;

  // Whether the preselected candidate is expired
  has_expired?: boolean;

  // Expiration notice to surface to user
  expiration_notice?: string;
}

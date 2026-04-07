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

const PENDING_BINDINGS_STORAGE_KEY = 'signalforge.pendingBindings';

export interface PendingBinding {
  // Event that triggered binding
  copyEvent: CopyBindingEvent;

  // Candidate projects (from authority resolver)
  candidates: ProjectCandidate[];

  // Project preselected by authority resolver
  preselectedProject?: ProjectCandidate;

  // Whether pin expired
  hasExpired: boolean;

  // Expiration notice if applicable
  expirationNotice?: string;

  // When this binding request was created
  createdAt: string;

  // Reason binding overlay should be shown
  reason: string;
}

export class BindingState {
  // Store pending bindings keyed by chat_id
  private pendingBindings: Map<string, PendingBinding> = new Map();

  private readonly readyPromise: Promise<void>;

  // Recent VS Code context (queried periodically)
  private vscodeContext: {
    activeWorkspace?: { project_id: string; workspace_root: string };
    pinnedProject?: PinState;
    recentProject?: { project_id: string; workspace_root: string };
    lastUpdated: string;
  } = {
    lastUpdated: new Date().toISOString(),
  };

  constructor() {
    this.readyPromise = this.restorePendingBindings();
  }

  async whenReady(): Promise<void> {
    await this.readyPromise;
  }

  private getStorageArea(): chrome.storage.StorageArea | null {
    return chrome.storage?.session || chrome.storage?.local || null;
  }

  private async restorePendingBindings(): Promise<void> {
    try {
      const storage = this.getStorageArea();
      if (!storage) return;

      const result = await storage.get(PENDING_BINDINGS_STORAGE_KEY);
      const stored = result[PENDING_BINDINGS_STORAGE_KEY] as Record<string, PendingBinding> | undefined;
      if (!stored || typeof stored !== 'object') return;

      this.pendingBindings = new Map(Object.entries(stored));
    } catch {
      // ignore storage restore failures and keep in-memory state only
    }
  }

  private async persistPendingBindings(): Promise<void> {
    try {
      const storage = this.getStorageArea();
      if (!storage) return;

      await storage.set({
        [PENDING_BINDINGS_STORAGE_KEY]: Object.fromEntries(this.pendingBindings.entries()),
      });
    } catch {
      // ignore persistence failures and keep in-memory state only
    }
  }

  /**
   * Store copy event and create pending binding
   * 
   * @param copyEvent Event from content script
   * @param candidates Ordered candidates from authority resolver
   * @param preselected Preselected candidate
   * @param options Optional configuration
   */
  storePendingBinding(
    copyEvent: CopyBindingEvent,
    candidates: ProjectCandidate[],
    preselected: ProjectCandidate | undefined,
    options?: {
      hasExpired?: boolean;
      expirationNotice?: string;
    }
  ): PendingBinding {
    const pendingBinding: PendingBinding = {
      copyEvent,
      candidates,
      preselectedProject: preselected,
      hasExpired: options?.hasExpired ?? false,
      expirationNotice: options?.expirationNotice,
      createdAt: new Date().toISOString(),
      reason: this.buildReason(preselected, options?.hasExpired),
    };

    this.pendingBindings.set(copyEvent.chat_id, pendingBinding);
    void this.persistPendingBindings();

    return pendingBinding;
  }

  /**
   * Get pending binding for a chat
   * 
   * @param chatId Chat ID to look up
   * @returns Pending binding or undefined
   */
  getPendingBinding(chatId: string): PendingBinding | undefined {
    return this.pendingBindings.get(chatId);
  }

  /**
   * Clear pending binding (after user confirms)
   * 
   * @param chatId Chat ID to clear
   */
  clearPendingBinding(chatId: string): void {
    this.pendingBindings.delete(chatId);
    void this.persistPendingBindings();
  }

  /**
   * Store VS Code context
   * 
   * Called when VS Code notifies us of project state
   * 
   * @param context VS Code context
   */
  updateVSCodeContext(context: {
    activeWorkspace?: { project_id: string; workspace_root: string };
    pinnedProject?: PinState;
    recentProject?: { project_id: string; workspace_root: string };
  }): void {
    this.vscodeContext = {
      ...context,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get current VS Code context
   * 
   * @returns Current context
   */
  getVSCodeContext() {
    return this.vscodeContext;
  }

  /**
   * Create bound artifact event from pending binding + user selection
   * 
   * @param pendingBinding The pending binding
   * @param selectedProject Project user selected
   * @returns Bound artifact event
   */
  createBoundArtifactEvent(
    pendingBinding: PendingBinding,
    selectedProject: ProjectCandidate
  ): BoundArtifactEvent {
    const { copyEvent } = pendingBinding;

    return {
      type: 'artifact_bound',
      chat_id: copyEvent.chat_id,
      project_id: selectedProject.project_id,
      authority: selectedProject.authority,
      copied_text: copyEvent.copied_text,
      selection_type: copyEvent.selection_type,
      source_url: copyEvent.source_url,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Build reason string for binding overlay
   * 
   * Explains why this binding flow was triggered
   * 
   * @param preselected Preselected project
   * @param hasExpired Whether pin expired
   * @returns Reason string
   */
  private buildReason(
    preselected: ProjectCandidate | undefined,
    hasExpired?: boolean
  ): string {
    if (hasExpired) {
      return 'Pinned project expired - confirm destination project';
    }

    if (!preselected) {
      return 'No project pinned - select destination project';
    }

    if (preselected.authority === 'pinned_project') {
      return `Using pinned project: ${preselected.project_id}`;
    }

    if (preselected.authority === 'active_workspace') {
      return `Using active workspace: ${preselected.project_id}`;
    }

    if (preselected.authority === 'recent_project') {
      return `Using recent project: ${preselected.project_id}`;
    }

    return 'Confirm destination project';
  }

  /**
   * Cleanup old pending bindings
   * 
   * Removes bindings older than ttlMinutes
   * 
   * @param ttlMinutes Time to live in minutes
   */
  cleanupStaleBindings(ttlMinutes: number = 30): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - ttlMinutes * 60_000);

    for (const [chatId, binding] of this.pendingBindings.entries()) {
      const createdAt = new Date(binding.createdAt);

      if (createdAt < cutoff) {
        this.pendingBindings.delete(chatId);
      }
    }
  }

  /**
   * Get all pending bindings (for debugging)
   * 
   * @returns Map of pending bindings
   */
  getAllPendingBindings(): Map<string, PendingBinding> {
    return new Map(this.pendingBindings);
  }
}

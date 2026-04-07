import * as vscode from 'vscode';
import type { PinState } from '@signalforge/shared/dist/types/binding';

/**
 * VS Code Extension Pin State Service
 *
 * Manages project pin state: temporary (TTL) or persistent.
 *
 * Critical rule:
 * If pin expires, surface notification.
 * No silent fallback to next authority source.
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
export class PinStateService {
  private readonly storageKey = 'signalforge.projectPin';
  private readonly extensionContext: vscode.ExtensionContext;
  private expirationCheckInterval?: ReturnType<typeof setInterval>;

  constructor(context: vscode.ExtensionContext) {
    this.extensionContext = context;
    this.startExpirationMonitor();
  }

  async setTemporaryPin(
    projectId: string,
    workspaceRoot: string,
    ttlMinutes: number = 30
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

    const pinState: PinState = {
      project_id: projectId,
      workspace_root: workspaceRoot,
      mode: 'temporary',
      pinned_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    await this.extensionContext.globalState.update(this.storageKey, pinState);

    vscode.window.showInformationMessage(
      `SignalForge: Project pinned for ${ttlMinutes} minutes (Pin ID: ${projectId})`
    );
  }

  async setPersistentPin(projectId: string, workspaceRoot: string): Promise<void> {
    const now = new Date();

    const pinState: PinState = {
      project_id: projectId,
      workspace_root: workspaceRoot,
      mode: 'persistent',
      pinned_at: now.toISOString(),
      expires_at: null,
    };

    await this.extensionContext.globalState.update(this.storageKey, pinState);

    vscode.window.showInformationMessage(
      `SignalForge: Project pinned (persistent) (Pin ID: ${projectId})`
    );
  }

  async clearPin(): Promise<void> {
    await this.extensionContext.globalState.update(this.storageKey, undefined);
    vscode.window.showInformationMessage('SignalForge: Pin cleared');
  }

  getPinState(): PinState | undefined {
    return this.extensionContext.globalState.get<PinState>(this.storageKey);
  }

  getResolvedPinState(): PinState | null {
    const pinState = this.getPinState();

    if (!pinState) {
      return null;
    }

    if (pinState.mode === 'persistent') {
      return pinState;
    }

    if (pinState.expires_at) {
      const expiresAt = new Date(pinState.expires_at);
      const now = new Date();

      if (now > expiresAt) {
        return null;
      }

      return pinState;
    }

    return pinState;
  }

  isPinValid(): boolean {
    return this.getResolvedPinState() !== null;
  }

  private startExpirationMonitor(): void {
    this.expirationCheckInterval = setInterval(() => {
      const pinState = this.getPinState();

      if (!pinState || pinState.mode === 'persistent') {
        return;
      }

      if (!pinState.expires_at) {
        return;
      }

      const expiresAt = new Date(pinState.expires_at);
      const now = new Date();

      if (now > expiresAt && this.getResolvedPinState() === null) {
        const notice = `${pinState.project_id} pin expired — defaulting to Active workspace`;

        vscode.window.showInformationMessage(`SignalForge: ${notice}`);
        this.emitExpirationEvent(pinState.project_id);
      }
    }, 30_000);
  }

  private emitExpirationEvent(projectId: string): void {
    console.log(`[PinStateService] Pin expired: ${projectId}`);
  }

  dispose(): void {
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
    }
  }
}

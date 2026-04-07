import * as vscode from 'vscode';
import { SessionBootstrapResult } from './sessionBootstrapService';

export type SessionStatusSnapshot = {
  projectId?: string;
  projectLabel?: string;
  status: 'ACTIVE' | 'BLOCKED' | 'IDLE';
  dispatch: 'READY' | 'NOT READY';
  browserCapture: 'ENABLED' | 'DISABLED';
  reason?: string;
  updatedAt: string;
};

export class SessionStatusReporter implements vscode.Disposable {
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly storageKey = 'signalforge.captureSessionStatus';

  constructor(private readonly context: vscode.ExtensionContext) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 120);
    const existing = this.context.globalState.get<SessionStatusSnapshot>(this.storageKey);
    if (existing) {
      void this.applySnapshot(existing);
    } else {
      this.statusBarItem.text = 'SignalForge Session: IDLE';
      this.statusBarItem.tooltip = 'SignalForge session has not been started.';
      this.statusBarItem.show();
    }
  }

  async update(result: SessionBootstrapResult): Promise<void> {
    const isCaptureReady = result.ok && result.state === 'capture_ready';
    const snapshot: SessionStatusSnapshot = {
      projectId: result.projectId,
      projectLabel: result.projectLabel,
      status: result.ok ? 'ACTIVE' : (result.state === 'blocked' ? 'BLOCKED' : 'IDLE'),
      dispatch: result.ok && result.state !== 'idle' ? 'READY' : 'NOT READY',
      browserCapture: isCaptureReady ? 'ENABLED' : 'DISABLED',
      reason: isCaptureReady ? 'authority emitted to native host; browser delivery not confirmed' : result.reason,
      updatedAt: new Date().toISOString(),
    };

    await this.context.globalState.update(this.storageKey, snapshot);
    await this.applySnapshot(snapshot);
  }

  private async applySnapshot(snapshot: SessionStatusSnapshot): Promise<void> {
    const projectLabel = snapshot.projectLabel || snapshot.projectId || 'unresolved';
    this.statusBarItem.text = `SignalForge Session: ${snapshot.status}`;
    this.statusBarItem.tooltip = [
      `**SignalForge Session**`,
      '',
      `Project: ${projectLabel}`,
      `Status: ${snapshot.status}`,
      `Dispatch: ${snapshot.dispatch}`,
      `Browser Capture: ${snapshot.browserCapture}`,
      snapshot.reason ? `Reason: ${snapshot.reason}` : '',
    ].filter(Boolean).join('\n');
    this.statusBarItem.show();
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
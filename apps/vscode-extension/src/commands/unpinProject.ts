import * as vscode from 'vscode';
import { PinStateService } from '../services/pinStateService';

/**
 * Command: SignalForge: Unpin Project
 * 
 * Clears current project pin
 * 
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
export async function unpinProject(pinStateService: PinStateService): Promise<void> {
  const pinState = pinStateService.getPinState();

  if (!pinState) {
    vscode.window.showInformationMessage('No project is currently pinned');
    return;
  }

  // Confirm unpinning
  const confirmed = await vscode.window.showWarningMessage(
    `Unpin project "${pinState.project_id}"?`,
    { modal: true },
    'Unpin'
  );

  if (confirmed !== 'Unpin') {
    return;
  }

  await pinStateService.clearPin();
}

/**
 * Register unpin project command
 * 
 * @param context Extension context
 * @param pinStateService Pin state service
 */
export function registerUnpinProject(
  context: vscode.ExtensionContext,
  pinStateService: PinStateService
): void {
  const disposable = vscode.commands.registerCommand(
    'signalforge.unpinProject',
    () => unpinProject(pinStateService)
  );

  context.subscriptions.push(disposable);
}

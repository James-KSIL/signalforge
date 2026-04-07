import * as vscode from 'vscode';
import { PinStateService } from '../services/pinStateService';

/**
 * Command: SignalForge: Pin Project (30 min)
 * 
 * Creates temporary pin for focused session (30 minutes)
 * 
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
export async function pinProjectTemporary(
  pinStateService: PinStateService,
  ttlMinutes: number = 30
): Promise<void> {
  // Get workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder is open');
    return;
  }

  // If single workspace, use it directly
  if (workspaceFolders.length === 1) {
    const workspaceFolder = workspaceFolders[0];

    // Show input for project ID
    const projectId = await vscode.window.showInputBox({
      prompt: 'Enter project ID to pin for 30 minutes',
      placeHolder: 'e.g., AutoOlympia',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project ID cannot be empty';
        }

        return null;
      },
    });

    if (!projectId) {
      return;
    }

    await pinStateService.setTemporaryPin(projectId.trim(), workspaceFolder.uri.fsPath, ttlMinutes);

    return;
  }

  // Multiple workspaces - ask user to select
  const selected = await vscode.window.showWorkspaceFolderPick({
    placeHolder: 'Select workspace to pin',
  });

  if (!selected) {
    return;
  }

  const projectId = await vscode.window.showInputBox({
    prompt: 'Enter project ID to pin for 30 minutes',
    placeHolder: 'e.g., AutoOlympia',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Project ID cannot be empty';
      }

      return null;
    },
  });

  if (!projectId) {
    return;
  }

  await pinStateService.setTemporaryPin(projectId.trim(), selected.uri.fsPath, ttlMinutes);
}

/**
 * Register pin project (temporary) command
 * 
 * @param context Extension context
 * @param pinStateService Pin state service
 */
export function registerPinProjectTemporary(
  context: vscode.ExtensionContext,
  pinStateService: PinStateService
): void {
  const disposable = vscode.commands.registerCommand(
    'signalforge.pinProjectTemporary',
    () => pinProjectTemporary(pinStateService, 30)
  );

  context.subscriptions.push(disposable);
}

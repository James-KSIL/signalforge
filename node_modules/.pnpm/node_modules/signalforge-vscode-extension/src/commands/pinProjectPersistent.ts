import * as vscode from 'vscode';
import { PinStateService } from '../services/pinStateService';

/**
 * Command: SignalForge: Pin Project Until Unpinned
 * 
 * Creates persistent pin (power-user mode)
 * Pin remains until explicitly unpinned
 * 
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
export async function pinProjectPersistent(pinStateService: PinStateService): Promise<void> {
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
      prompt: 'Enter project ID to pin (persistent until unpinned)',
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

    // Confirm persistent pin
    const confirmed = await vscode.window.showWarningMessage(
      `Pin project "${projectId.trim()}" persistently? This pin will remain until explicitly unpinned.`,
      { modal: true },
      'Confirm'
    );

    if (confirmed !== 'Confirm') {
      return;
    }

    await pinStateService.setPersistentPin(projectId.trim(), workspaceFolder.uri.fsPath);

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
    prompt: 'Enter project ID to pin (persistent until unpinned)',
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

  // Confirm persistent pin
  const confirmed = await vscode.window.showWarningMessage(
    `Pin project "${projectId.trim()}" persistently? This pin will remain until explicitly unpinned.`,
    { modal: true },
    'Confirm'
  );

  if (confirmed !== 'Confirm') {
    return;
  }

  await pinStateService.setPersistentPin(projectId.trim(), selected.uri.fsPath);
}

/**
 * Register pin project (persistent) command
 * 
 * @param context Extension context
 * @param pinStateService Pin state service
 */
export function registerPinProjectPersistent(
  context: vscode.ExtensionContext,
  pinStateService: PinStateService
): void {
  const disposable = vscode.commands.registerCommand(
    'signalforge.pinProjectPersistent',
    () => pinProjectPersistent(pinStateService)
  );

  context.subscriptions.push(disposable);
}

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPinProjectPersistent = exports.pinProjectPersistent = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Command: SignalForge: Pin Project Until Unpinned
 *
 * Creates persistent pin (power-user mode)
 * Pin remains until explicitly unpinned
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
async function pinProjectPersistent(pinStateService) {
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
        const confirmed = await vscode.window.showWarningMessage(`Pin project "${projectId.trim()}" persistently? This pin will remain until explicitly unpinned.`, { modal: true }, 'Confirm');
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
    const confirmed = await vscode.window.showWarningMessage(`Pin project "${projectId.trim()}" persistently? This pin will remain until explicitly unpinned.`, { modal: true }, 'Confirm');
    if (confirmed !== 'Confirm') {
        return;
    }
    await pinStateService.setPersistentPin(projectId.trim(), selected.uri.fsPath);
}
exports.pinProjectPersistent = pinProjectPersistent;
/**
 * Register pin project (persistent) command
 *
 * @param context Extension context
 * @param pinStateService Pin state service
 */
function registerPinProjectPersistent(context, pinStateService) {
    const disposable = vscode.commands.registerCommand('signalforge.pinProjectPersistent', () => pinProjectPersistent(pinStateService));
    context.subscriptions.push(disposable);
}
exports.registerPinProjectPersistent = registerPinProjectPersistent;

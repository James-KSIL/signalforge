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
exports.registerPinProjectTemporary = exports.pinProjectTemporary = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Command: SignalForge: Pin Project (30 min)
 *
 * Creates temporary pin for focused session (30 minutes)
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
async function pinProjectTemporary(pinStateService, ttlMinutes = 30) {
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
exports.pinProjectTemporary = pinProjectTemporary;
/**
 * Register pin project (temporary) command
 *
 * @param context Extension context
 * @param pinStateService Pin state service
 */
function registerPinProjectTemporary(context, pinStateService) {
    const disposable = vscode.commands.registerCommand('signalforge.pinProjectTemporary', () => pinProjectTemporary(pinStateService, 30));
    context.subscriptions.push(disposable);
}
exports.registerPinProjectTemporary = registerPinProjectTemporary;

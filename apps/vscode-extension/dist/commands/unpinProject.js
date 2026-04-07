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
exports.registerUnpinProject = exports.unpinProject = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Command: SignalForge: Unpin Project
 *
 * Clears current project pin
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
async function unpinProject(pinStateService) {
    const pinState = pinStateService.getPinState();
    if (!pinState) {
        vscode.window.showInformationMessage('No project is currently pinned');
        return;
    }
    // Confirm unpinning
    const confirmed = await vscode.window.showWarningMessage(`Unpin project "${pinState.project_id}"?`, { modal: true }, 'Unpin');
    if (confirmed !== 'Unpin') {
        return;
    }
    await pinStateService.clearPin();
}
exports.unpinProject = unpinProject;
/**
 * Register unpin project command
 *
 * @param context Extension context
 * @param pinStateService Pin state service
 */
function registerUnpinProject(context, pinStateService) {
    const disposable = vscode.commands.registerCommand('signalforge.unpinProject', () => unpinProject(pinStateService));
    context.subscriptions.push(disposable);
}
exports.registerUnpinProject = registerUnpinProject;

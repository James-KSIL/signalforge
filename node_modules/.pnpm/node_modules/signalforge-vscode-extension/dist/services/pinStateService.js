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
exports.PinStateService = void 0;
const vscode = __importStar(require("vscode"));
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
class PinStateService {
    constructor(context) {
        this.storageKey = 'signalforge.projectPin';
        this.extensionContext = context;
        this.startExpirationMonitor();
    }
    async setTemporaryPin(projectId, workspaceRoot, ttlMinutes = 30) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlMinutes * 60000);
        const pinState = {
            project_id: projectId,
            workspace_root: workspaceRoot,
            mode: 'temporary',
            pinned_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
        };
        await this.extensionContext.globalState.update(this.storageKey, pinState);
        vscode.window.showInformationMessage(`SignalForge: Project pinned for ${ttlMinutes} minutes (Pin ID: ${projectId})`);
    }
    async setPersistentPin(projectId, workspaceRoot) {
        const now = new Date();
        const pinState = {
            project_id: projectId,
            workspace_root: workspaceRoot,
            mode: 'persistent',
            pinned_at: now.toISOString(),
            expires_at: null,
        };
        await this.extensionContext.globalState.update(this.storageKey, pinState);
        vscode.window.showInformationMessage(`SignalForge: Project pinned (persistent) (Pin ID: ${projectId})`);
    }
    async clearPin() {
        await this.extensionContext.globalState.update(this.storageKey, undefined);
        vscode.window.showInformationMessage('SignalForge: Pin cleared');
    }
    getPinState() {
        return this.extensionContext.globalState.get(this.storageKey);
    }
    getResolvedPinState() {
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
    isPinValid() {
        return this.getResolvedPinState() !== null;
    }
    startExpirationMonitor() {
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
        }, 30000);
    }
    emitExpirationEvent(projectId) {
        console.log(`[PinStateService] Pin expired: ${projectId}`);
    }
    dispose() {
        if (this.expirationCheckInterval) {
            clearInterval(this.expirationCheckInterval);
        }
    }
}
exports.PinStateService = PinStateService;

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
exports.SessionStatusReporter = void 0;
const vscode = __importStar(require("vscode"));
class SessionStatusReporter {
    constructor(context) {
        this.context = context;
        this.storageKey = 'signalforge.captureSessionStatus';
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 120);
        const existing = this.context.globalState.get(this.storageKey);
        if (existing) {
            void this.applySnapshot(existing);
        }
        else {
            this.statusBarItem.text = 'SignalForge Session: IDLE';
            this.statusBarItem.tooltip = 'SignalForge session has not been started.';
            this.statusBarItem.show();
        }
    }
    async update(result) {
        const isCaptureReady = result.ok && result.state === 'capture_ready';
        const snapshot = {
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
    async applySnapshot(snapshot) {
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
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.SessionStatusReporter = SessionStatusReporter;

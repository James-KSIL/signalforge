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
export declare class SessionStatusReporter implements vscode.Disposable {
    private readonly context;
    private readonly statusBarItem;
    private readonly storageKey;
    constructor(context: vscode.ExtensionContext);
    update(result: SessionBootstrapResult): Promise<void>;
    private applySnapshot;
    dispose(): void;
}

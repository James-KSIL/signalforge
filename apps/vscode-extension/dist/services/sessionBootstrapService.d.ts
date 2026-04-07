import * as vscode from 'vscode';
export type SessionBootstrapState = 'idle' | 'project_resolved' | 'project_pinned' | 'dispatch_seeded' | 'capture_ready' | 'blocked';
export type SessionBootstrapResult = {
    ok: boolean;
    state: SessionBootstrapState;
    projectId?: string;
    projectLabel?: string;
    reason?: string;
};
type BootstrapProgressHandler = (result: SessionBootstrapResult) => void | Promise<void>;
export declare class SessionBootstrapService {
    private readonly context;
    private readonly getDb?;
    constructor(context: vscode.ExtensionContext, getDb?: (() => any) | undefined);
    private openCoreDatabase;
    bootstrapCaptureSession(onProgress?: BootstrapProgressHandler): Promise<SessionBootstrapResult>;
    private resolveWorkspaceTarget;
    private resolveProjectIdentity;
    private persistProjectPin;
    private persistActiveProjectAuthority;
    private seedDispatchState;
    private emitBootstrapAuthority;
}
export {};

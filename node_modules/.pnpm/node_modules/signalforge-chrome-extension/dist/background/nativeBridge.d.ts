type NativeBridgeResponse = {
    type?: 'ack' | 'error' | string;
    kind?: string;
    ok?: boolean;
    message_id?: string;
    eventId?: string;
    status?: string;
    reason?: string;
    error?: string;
    [key: string]: unknown;
};
type BootstrapAuthorityPayload = {
    type: 'bootstrap_authority';
    project_id: string;
    project_label: string;
    authority: string;
    timestamp: string;
    workspace_root?: string | null;
    session_id?: string | null;
    dispatch_id?: string | null;
};
export declare function sendBrowserEvent(message: any): Promise<NativeBridgeResponse>;
export declare function sendCopyBindingRequested(payload: any): Promise<NativeBridgeResponse>;
export declare function sendArtifactBound(payload: any): Promise<NativeBridgeResponse>;
export declare function sendCopilotCandidateLookup(payload: {
    project_id: string;
    session_id?: string;
    text_hash: string;
    normalized_length: number;
    excerpt: string;
    captured_at: string;
}): Promise<NativeBridgeResponse>;
export declare function getBootstrapAuthority(): Promise<{
    project_id: string;
    project_label: string;
    authority: string;
    timestamp: string;
    session_id?: string | null;
    dispatch_id?: string | null;
} | null>;
export declare function onBootstrapAuthorityPush(listener: (payload: BootstrapAuthorityPayload) => void): () => void;
export declare function ensureNativeBridgeConnected(): Promise<void>;
export declare function getBridgeStatus(): {
    connected: boolean;
    lastError: string | null;
};
export {};

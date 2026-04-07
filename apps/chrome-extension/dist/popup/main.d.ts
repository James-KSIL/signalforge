type BindingStateResponse = {
    pendingBindings?: Array<{
        chat_id: string;
        copied_text: string;
        selection_type: string;
        source_url: string;
        created_at: string;
        reason: string;
        has_expired?: boolean;
        expiration_notice?: string;
    }>;
    bridge?: {
        connected: boolean;
        lastError: string | null;
    };
    awaitingDispatch?: string[];
};
declare function sendMessage<T>(message: any): Promise<T>;
declare function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, textContent?: string): HTMLElementTagNameMap[K];
declare function render(): void;

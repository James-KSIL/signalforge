export type ChatGPTVerificationEventRow = {
    verification_id: string;
    project_id: string;
    session_id: string;
    dispatch_id: string | null;
    thread_id: string;
    turn_id: string;
    captured_at: string;
    raw_text: string;
    classification_signals_json: string;
    source: 'chatgpt';
};
export declare function insertChatGPTVerificationEvent(db: any, row: ChatGPTVerificationEventRow): Promise<void>;
export declare function getLatestChatGPTVerificationEvent(db: any, projectId: string, sessionId: string): Promise<ChatGPTVerificationEventRow | null>;

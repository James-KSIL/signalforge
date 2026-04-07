export interface ChatEventRow {
    event_id: string;
    chat_thread_id: string;
    project_id: string;
    session_id?: string | null;
    dispatch_id?: string | null;
    source: 'vscode' | 'browser' | 'cli';
    turn_index: number;
    role: string | null;
    event_type: string;
    content: string;
    artifact_refs?: string | null;
    source_url: string | null;
    matched_trigger: string | null;
    created_at: string;
}

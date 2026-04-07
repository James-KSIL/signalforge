export type ChatRole = 'user' | 'assistant';
export type BrowserEventType = 'chat_turn_completed' | 'dispatch_phrase_detected' | 'dispatch_candidate_created' | 'copilot_candidate_captured' | 'chatgpt_turn_classified' | 'copilot_candidate_lookup_query';
export interface ChatTurnCompletedEvent {
    type: 'chat_turn_completed';
    eventId: string;
    chatThreadId: string;
    sourceUrl: string;
    turnIndex: number;
    role: ChatRole;
    content: string;
    createdAt: string;
}
export interface DispatchPhraseDetectedEvent {
    type: 'dispatch_phrase_detected';
    eventId: string;
    chatThreadId: string;
    sourceUrl: string;
    turnIndex: number;
    content: string;
    matchedTrigger: string;
    createdAt: string;
}
export interface DispatchCandidateCreatedEvent {
    type: 'dispatch_candidate_created';
    eventId: string;
    chatThreadId: string;
    sourceUrl: string;
    turnIndex: number;
    content: string;
    createdAt: string;
}
export interface CopilotCandidateCapturedEvent {
    type: 'copilot_candidate_captured';
    candidate_id: string;
    project_id: string;
    session_id: string;
    dispatch_id?: string | null;
    captured_at: string;
    source: 'clipboard';
    raw_text: string;
    signal_flags: {
        min_length_ok: boolean;
        technical_structure_ok: boolean;
        implementation_language_ok: boolean;
        build_diagnostic_ok: boolean;
        completion_marker_ok: boolean;
        structural_integrity_ok: boolean;
        signal_total_score: number;
        technical_signal_score: number;
        build_signal_score: number;
        completion_signal_score: number;
        matched_signals: string[];
        threshold_passed: boolean;
        text_length: number;
        minimum_length: number;
    };
    capture_context?: {
        source_url?: string;
        selection_type?: 'manual' | 'canvas';
        chat_id?: string;
    };
}
export type ChatEvidenceClassification = 'contract_input' | 'chatgpt_verification_response' | 'copilot_execution_narrative_pasted';
export interface ChatGPTTurnClassifiedEvent {
    type: 'chatgpt_turn_classified';
    eventId: string;
    chatThreadId: string;
    sourceUrl: string;
    turnIndex: number;
    role: ChatRole;
    content: string;
    classification: ChatEvidenceClassification;
    project_id: string;
    session_id: string;
    dispatch_id?: string | null;
    timestamp: string;
    classification_signals: string[];
    summary_reason: string;
    correlated_candidate_id?: string | null;
}
export interface CopilotCandidateLookupQueryEvent {
    type: 'copilot_candidate_lookup_query';
    project_id: string;
    session_id?: string;
    text_hash: string;
    normalized_length: number;
    excerpt: string;
    captured_at: string;
}
export type BrowserEvent = ChatTurnCompletedEvent | DispatchPhraseDetectedEvent | DispatchCandidateCreatedEvent | CopilotCandidateCapturedEvent | ChatGPTTurnClassifiedEvent | CopilotCandidateLookupQueryEvent;

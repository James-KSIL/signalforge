type ChatRole = 'user' | 'assistant';
export type ChatEvidenceClassification = 'contract_input' | 'chatgpt_verification_response' | 'copilot_execution_narrative_pasted';
export type ClassificationResult = {
    classification: ChatEvidenceClassification;
    signals: string[];
    summaryReason: string;
};
export declare function classifyTurn(role: ChatRole, text: string): ClassificationResult | null;
export {};

/**
 * SignalForge content bundle for MV3 classic content script execution.
 *
 * This file intentionally contains no imports/exports.
 */
type Outgoing = any;
type ChatRole = 'user' | 'assistant';
interface ExtractedTurn {
    role: ChatRole;
    text: string;
}
interface ChatObserverConfig {
    debug?: boolean;
}
interface CopyInterceptorConfig {
    debug?: boolean;
}
type CopilotSignalFlags = {
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
type CopilotClipboardCandidate = {
    candidate_id: string;
    project_id: string;
    session_id: string;
    dispatch_id: string | null;
    captured_at: string;
    source: 'clipboard';
    raw_text: string;
    signal_flags: CopilotSignalFlags;
    capture_context: {
        source_url: string;
        selection_type: 'manual' | 'canvas';
        chat_id: string;
    };
};
type ChatEvidenceClassification = 'contract_input' | 'chatgpt_verification_response' | 'copilot_execution_narrative_pasted';
type ClassificationResult = {
    classification: ChatEvidenceClassification;
    signals: string[];
    summaryReason: string;
};
type CopilotSignature = {
    text_hash: string;
    normalized_length: number;
    excerpt: string;
    captured_at: string;
};
type DedupMatch = {
    candidate_id: string;
    summary_reason: string;
};
declare const COPILOT_DISCRIMINATOR_MIN_LEN = 360;
declare const COPILOT_CANDIDATE_BUFFER_KEY = "signalforge.copilotCandidateBuffer";
declare const COPILOT_CANDIDATE_BUFFER_LIMIT = 20;
declare const DISPATCH_TRIGGERS: string[];
declare function normalizeText(text: string): string;
declare function computeTextHash(text: string): string;
declare function tokenOverlapRatio(a: string, b: string): number;
declare function containsAny(lower: string, terms: string[]): string[];
declare function hasStructuredInstructionBlocks(text: string): boolean;
declare function detectExecutionSignals(text: string): string[];
declare function classifyTurnDeterministic(role: ChatRole, text: string): ClassificationResult | null;
declare function simpleId(prefix?: string): string;
declare function nowIso(): string;
declare function detectDispatchTrigger(text: string): string | null;
declare function extractTurnsFromPage(): ExtractedTurn[];
declare class ChatObserver {
    private readonly config;
    private readonly threadId;
    private turnIndexCounter;
    private readonly emittedSignatures;
    constructor(config?: ChatObserverConfig);
    private init;
    private computeThreadId;
    private sendEvent;
    private signatureFor;
    private readActiveBindingContext;
    private readCandidateBuffer;
    private computeSignature;
    private resolveBufferDedupMatch;
    private lookupNativeDedupMatch;
    private classifyAndEmitTurn;
    private observeConversations;
}
declare class CopyInterceptor {
    private readonly chatGPTOrigins;
    private readonly config;
    private listeningForCopy;
    private lastCopySignature;
    private readonly implementationPhrases;
    constructor(config?: CopyInterceptorConfig);
    private init;
    private setupCopyListener;
    private setupCanvasClickListener;
    private handleCopyEvent;
    private handleCopyButton;
    private evaluateAndStageCopilotCandidate;
    private computeCopilotSignalFlags;
    private getStorageSnapshot;
    private stageCandidateInBuffer;
    private emitCopilotCandidateCaptured;
    private sendCopyBindingRequest;
    private isDuplicateCopy;
    private extractChatId;
    private isStandardResponseCopyButton;
    private isCanvasCopyButton;
    private logCanvasClickCandidate;
    private resolveStandardResponseCopyContent;
    private resolveCanvasCopyContent;
    private findCanvasWrapper;
    private findSiblingContentNearActions;
    private findBestContentCandidate;
    private isUsableContentNode;
    private logCopyButtonAncestorChain;
    private extractTextFromMessageBlock;
    private isOnChatGPT;
    private log;
}

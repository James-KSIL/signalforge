export type CopilotCandidatePayload = {
    candidate_id: string;
    project_id: string;
    session_id: string;
    dispatch_id?: string | null;
    contract_ref?: string | null;
    captured_at: string;
    source: 'clipboard';
    raw_text: string;
    content_hash?: string | null;
    signal_flags?: Record<string, unknown>;
    capture_context?: Record<string, unknown>;
};
export type ExecutionSignals = {
    build_command_detected: boolean;
    test_result_detected: boolean;
    command_outcome_line_detected: boolean;
};
export type ContractGateResult = {
    gatePass: boolean;
    failedInvariants: string[];
    gateFailureReason: string | null;
    executionSignals: ExecutionSignals;
    executionSignalsCount: number;
    resolvedWorkspaceFiles: string[];
};
export type ValidationResult = {
    ok: boolean;
    candidateId: string;
    reasons: string[];
    extractedFileRefs: string[];
    matchedWorkspaceFiles: string[];
    matchedDiffFiles: string[];
    evidence: {
        length_ok: boolean;
        technical_markers_ok: boolean;
        build_diagnostic_ok: boolean;
        completion_marker_ok: boolean;
        signal_total_score: number;
        technical_signal_score: number;
        build_signal_score: number;
        completion_signal_score: number;
        workspace_refs_ok: boolean;
        git_correlation_ok: boolean;
        semantic_alignment_ok: boolean;
        structural_integrity_ok: boolean;
        session_binding_ok: boolean;
    };
};
export type ValidationContext = {
    workspaceRoot?: string;
    gitModifiedFiles?: string[];
    workspaceFiles?: string[];
    buildSignals?: string[];
};
export declare function extractFileReferences(rawText: string): string[];
export declare function passesContractGate(candidate: CopilotCandidatePayload, context?: ValidationContext): ContractGateResult;
export declare function validateCopilotCandidate(candidate: CopilotCandidatePayload, context?: ValidationContext): ValidationResult;

export type OutcomeLogRow = {
    outcome_id: string;
    project_id: string;
    session_id: string;
    dispatch_id: string;
    candidate_id: string | null;
    created_at: string;
    contract_ref: string | null;
    artifact_ref: string | null;
    verification_ref: string | null;
    rejection_reason: string | null;
    outcome_summary: string;
    outcome_status: 'success' | 'partial' | 'failed';
    source: 'auto';
};
export declare function insertOutcomeLog(db: any, row: OutcomeLogRow): Promise<void>;
export declare function getLatestOutcomeLog(db: any, projectId: string, sessionId: string): Promise<OutcomeLogRow | null>;

import type { CopilotCandidateStagingRow } from '../repositories/copilotCandidateRepository';
import type { CopilotExecutionArtifactRow } from '../repositories/copilotArtifactRepository';
import type { OutcomeLogRow } from '../repositories/outcomeLogRepository';
export type ResolvedOutcomeContractRow = {
    event_id: string;
    created_at: string;
    content: string;
};
export type ResolvedOutcomeSummaryInput = {
    outcome: OutcomeLogRow;
    candidate: CopilotCandidateStagingRow;
    artifact: CopilotExecutionArtifactRow | null;
    contract: ResolvedOutcomeContractRow | null;
};
export type ResolvedOutcomeSummary = {
    outcome_id: string;
    outcome_status: OutcomeLogRow['outcome_status'];
    dispatch_id: string;
    candidate_id: string;
    contract_ref: string | null;
    contract_summary: string | null;
    artifact_ref: string | null;
    rejection_reason: string | null;
    affected_file_refs: string[];
    explanation: string;
    summary_text: string;
};
export declare function buildResolvedOutcomeSummary(input: ResolvedOutcomeSummaryInput): ResolvedOutcomeSummary;

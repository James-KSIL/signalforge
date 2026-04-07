import type { CopilotCandidateStagingRow } from '../repositories/copilotCandidateRepository';
import type { CopilotExecutionArtifactRow } from '../repositories/copilotArtifactRepository';
import type { OutcomeLogRow } from '../repositories/outcomeLogRepository';
export type DeterministicAdrContractRow = {
    event_id: string;
    created_at: string;
    content: string;
};
export type DeterministicAdrInput = {
    outcome: OutcomeLogRow;
    candidate: CopilotCandidateStagingRow;
    artifact: CopilotExecutionArtifactRow | null;
    contract: DeterministicAdrContractRow | null;
};
export type DeterministicAdrDecision = 'PROMOTED' | 'REJECTED';
export type DeterministicAdrRender = {
    adr_id: string;
    markdown: string;
    decision: DeterministicAdrDecision;
};
export declare function buildDeterministicAdrV1(input: DeterministicAdrInput): DeterministicAdrRender;
export declare const renderDeterministicAdr: typeof buildDeterministicAdrV1;

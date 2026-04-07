export type CopilotExecutionArtifactRow = {
    artifact_id: string;
    candidate_id: string;
    project_id: string;
    session_id: string;
    dispatch_id: string | null;
    validated_at: string;
    raw_text: string;
    extracted_file_refs_json: string | null;
    git_correlation_json: string | null;
    validation_evidence_json: string;
    source: string;
    artifact_type: string;
};
export declare function insertCopilotExecutionArtifact(db: any, row: CopilotExecutionArtifactRow): Promise<void>;

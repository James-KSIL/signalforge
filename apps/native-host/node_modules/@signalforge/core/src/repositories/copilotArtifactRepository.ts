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

function dbRun(db: any, sql: string, params: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function insertCopilotExecutionArtifact(db: any, row: CopilotExecutionArtifactRow): Promise<void> {
  const sql = `INSERT INTO copilot_execution_artifacts(
    artifact_id,
    candidate_id,
    project_id,
    session_id,
    dispatch_id,
    validated_at,
    raw_text,
    extracted_file_refs_json,
    git_correlation_json,
    validation_evidence_json,
    source,
    artifact_type
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  await dbRun(db, sql, [
    row.artifact_id,
    row.candidate_id,
    row.project_id,
    row.session_id,
    row.dispatch_id,
    row.validated_at,
    row.raw_text,
    row.extracted_file_refs_json,
    row.git_correlation_json,
    row.validation_evidence_json,
    row.source,
    row.artifact_type,
  ]);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertCopilotExecutionArtifact = void 0;
function dbRun(db, sql, params) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err)
                return reject(err);
            resolve();
        });
    });
}
async function insertCopilotExecutionArtifact(db, row) {
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
exports.insertCopilotExecutionArtifact = insertCopilotExecutionArtifact;

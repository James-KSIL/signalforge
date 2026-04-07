"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentCopilotCandidates = exports.getCopilotCandidateById = exports.updateCopilotCandidateEvaluation = exports.updateCopilotCandidateStatus = exports.insertCopilotCandidateStaging = void 0;
function dbRun(db, sql, params) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err)
                return reject(err);
            resolve();
        });
    });
}
function dbAll(db, sql, params) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                return reject(err);
            resolve(rows || []);
        });
    });
}
async function insertCopilotCandidateStaging(db, row) {
    const sql = `INSERT INTO copilot_candidate_staging(
    candidate_id,
    project_id,
    session_id,
    dispatch_id,
    contract_ref,
    captured_at,
    source,
    raw_text,
    content_hash,
    signal_flags_json,
    capture_context_json,
    diagnostic_score,
    gate_pass,
    gate_failure_reason,
    failed_invariants_json,
    validation_status,
    rejection_reason
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    try {
        await dbRun(db, sql, [
            row.candidate_id,
            row.project_id,
            row.session_id,
            row.dispatch_id,
            row.contract_ref,
            row.captured_at,
            row.source,
            row.raw_text,
            row.content_hash,
            row.signal_flags_json,
            row.capture_context_json,
            row.diagnostic_score,
            row.gate_pass,
            row.gate_failure_reason,
            row.failed_invariants_json,
            row.validation_status,
            row.rejection_reason,
        ]);
    }
    catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT' || /constraint/i.test(err.message || '')) {
            return;
        }
        throw err;
    }
}
exports.insertCopilotCandidateStaging = insertCopilotCandidateStaging;
async function updateCopilotCandidateStatus(db, candidateId, status, rejectionReason) {
    const sql = `UPDATE copilot_candidate_staging
    SET validation_status = ?, rejection_reason = ?
    WHERE candidate_id = ?`;
    await dbRun(db, sql, [status, rejectionReason, candidateId]);
}
exports.updateCopilotCandidateStatus = updateCopilotCandidateStatus;
async function updateCopilotCandidateEvaluation(db, candidateId, updates) {
    const sql = `UPDATE copilot_candidate_staging
    SET diagnostic_score = ?, gate_pass = ?, gate_failure_reason = ?, failed_invariants_json = ?
    WHERE candidate_id = ?`;
    await dbRun(db, sql, [
        updates.diagnosticScore,
        updates.gatePass ? 1 : 0,
        updates.gateFailureReason,
        updates.failedInvariantsJson,
        candidateId,
    ]);
}
exports.updateCopilotCandidateEvaluation = updateCopilotCandidateEvaluation;
async function getCopilotCandidateById(db, candidateId) {
    const sql = 'SELECT * FROM copilot_candidate_staging WHERE candidate_id = ? LIMIT 1';
    const rows = await dbAll(db, sql, [candidateId]);
    return rows[0] || null;
}
exports.getCopilotCandidateById = getCopilotCandidateById;
async function getRecentCopilotCandidates(db, projectId, sessionId, limit = 40) {
    const normalizedLimit = Math.max(1, Math.min(200, limit));
    if (sessionId && String(sessionId).trim()) {
        const sql = `SELECT * FROM copilot_candidate_staging
      WHERE project_id = ? AND session_id = ?
      ORDER BY captured_at DESC
      LIMIT ${normalizedLimit}`;
        return dbAll(db, sql, [projectId, sessionId]);
    }
    const sql = `SELECT * FROM copilot_candidate_staging
    WHERE project_id = ?
    ORDER BY captured_at DESC
    LIMIT ${normalizedLimit}`;
    return dbAll(db, sql, [projectId]);
}
exports.getRecentCopilotCandidates = getRecentCopilotCandidates;

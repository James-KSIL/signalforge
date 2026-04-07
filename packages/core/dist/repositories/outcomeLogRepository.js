"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestOutcomeLog = exports.insertOutcomeLog = void 0;
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
async function insertOutcomeLog(db, row) {
    const sql = `INSERT INTO outcome_logs(
    outcome_id,
    project_id,
    session_id,
    dispatch_id,
    candidate_id,
    created_at,
    contract_ref,
    artifact_ref,
    verification_ref,
    rejection_reason,
    outcome_summary,
    outcome_status,
    source
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    try {
        await dbRun(db, sql, [
            row.outcome_id,
            row.project_id,
            row.session_id,
            row.dispatch_id,
            row.candidate_id,
            row.created_at,
            row.contract_ref,
            row.artifact_ref,
            row.verification_ref,
            row.rejection_reason,
            row.outcome_summary,
            row.outcome_status,
            row.source,
        ]);
    }
    catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT' || /constraint/i.test(err.message || '')) {
            return;
        }
        throw err;
    }
}
exports.insertOutcomeLog = insertOutcomeLog;
async function getLatestOutcomeLog(db, projectId, sessionId) {
    const sql = `SELECT * FROM outcome_logs
    WHERE project_id = ? AND session_id = ?
    ORDER BY created_at DESC
    LIMIT 1`;
    const rows = await dbAll(db, sql, [projectId, sessionId]);
    return rows[0] || null;
}
exports.getLatestOutcomeLog = getLatestOutcomeLog;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestChatGPTVerificationEvent = exports.insertChatGPTVerificationEvent = void 0;
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
async function insertChatGPTVerificationEvent(db, row) {
    const sql = `INSERT INTO chatgpt_verification_events(
    verification_id,
    project_id,
    session_id,
    dispatch_id,
    thread_id,
    turn_id,
    captured_at,
    raw_text,
    classification_signals_json,
    source
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    try {
        await dbRun(db, sql, [
            row.verification_id,
            row.project_id,
            row.session_id,
            row.dispatch_id,
            row.thread_id,
            row.turn_id,
            row.captured_at,
            row.raw_text,
            row.classification_signals_json,
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
exports.insertChatGPTVerificationEvent = insertChatGPTVerificationEvent;
async function getLatestChatGPTVerificationEvent(db, projectId, sessionId) {
    const sql = `SELECT * FROM chatgpt_verification_events
    WHERE project_id = ? AND session_id = ?
    ORDER BY captured_at DESC
    LIMIT 1`;
    const rows = await dbAll(db, sql, [projectId, sessionId]);
    return rows[0] || null;
}
exports.getLatestChatGPTVerificationEvent = getLatestChatGPTVerificationEvent;

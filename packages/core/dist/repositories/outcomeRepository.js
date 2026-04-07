"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOutcomesByProject = exports.getOutcomesByDispatch = exports.insertOutcomeWithEvent = exports.insertOutcome = void 0;
function insertOutcome(db, row) {
    const sql = `INSERT INTO outcomes(outcome_id, project_id, session_id, dispatch_thread_id, status, title, what_changed, what_broke, next_step, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    return new Promise((resolve, reject) => {
        try {
            db.run(sql, [
                row.outcome_id,
                row.project_id,
                row.session_id,
                row.dispatch_thread_id,
                row.status,
                row.title,
                row.what_changed,
                row.what_broke,
                row.next_step,
                row.created_at,
            ], (err) => {
                if (err) {
                    // ignore constraint errors
                    if (err.code === 'SQLITE_CONSTRAINT' || /constraint/i.test(err.message || ''))
                        return resolve();
                    return reject(err);
                }
                resolve();
            });
        }
        catch (e) {
            reject(e);
        }
    });
}
exports.insertOutcome = insertOutcome;
// Also write a canonical chat_event record for the outcome so ADR/session
// generators can rely on event streams.
const outcome_1 = require("../events/outcome");
const chatEventRepository_1 = require("./chatEventRepository");
const helpers_1 = require("../events/helpers");
function normalizeOutcomeStatus(status) {
    if (status === 'success' || status === 'partial' || status === 'fail')
        return status;
    if (status === 'failed' || status === 'blocked')
        return 'fail';
    return 'partial';
}
async function insertOutcomeWithEvent(db, row) {
    if (!row.project_id || !String(row.project_id).trim()) {
        throw new Error('Outcome requires project_id');
    }
    // Resolve thread_id using same logic as event creation to ensure consistency
    const resolvedThreadId = row.dispatch_thread_id || row.session_id || 'unknown-thread';
    // Ensure outcome row has the resolved thread_id for consistent querying
    const normalizedRow = { ...row, dispatch_thread_id: resolvedThreadId };
    await insertOutcome(db, normalizedRow);
    // Emit canonical outcome event into chat_events
    try {
        const outcomeEvent = (0, outcome_1.buildOutcomeEvent)(resolvedThreadId, {
            projectId: row.project_id,
            sessionId: row.session_id || undefined,
            dispatchId: (0, helpers_1.toDispatchId)(row.dispatch_thread_id || resolvedThreadId),
            source: row.source || 'cli',
            status: normalizeOutcomeStatus(row.status),
            title: row.title,
            whatChanged: row.what_changed || '',
            resistance: row.what_broke || undefined,
            nextStep: row.next_step || '',
        });
        await (0, chatEventRepository_1.insertChatEvent)(db, {
            chat_thread_id: outcomeEvent.thread_id,
            project_id: outcomeEvent.project_id,
            session_id: outcomeEvent.session_id,
            dispatch_id: outcomeEvent.dispatch_id,
            source: outcomeEvent.source,
            role: outcomeEvent.role,
            event_type: outcomeEvent.event_type,
            content: JSON.stringify(outcomeEvent.content),
            artifact_refs: outcomeEvent.content.artifact_refs ? JSON.stringify(outcomeEvent.content.artifact_refs) : null,
            created_at: outcomeEvent.timestamp,
        });
    }
    catch (e) {
        // best-effort: do not fail outcome insertion for event emission failures
    }
}
exports.insertOutcomeWithEvent = insertOutcomeWithEvent;
function getOutcomesByDispatch(db, dispatchThreadId) {
    const sql = `SELECT * FROM outcomes WHERE dispatch_thread_id = ? ORDER BY created_at ASC`;
    return new Promise((resolve, reject) => {
        try {
            db.all(sql, [dispatchThreadId], (err, rows) => {
                if (err)
                    return reject(err);
                resolve(rows || []);
            });
        }
        catch (e) {
            reject(e);
        }
    });
}
exports.getOutcomesByDispatch = getOutcomesByDispatch;
function getOutcomesByProject(db, projectId) {
    const sql = `SELECT * FROM outcomes WHERE project_id = ? ORDER BY created_at ASC`;
    return new Promise((resolve, reject) => {
        try {
            db.all(sql, [projectId], (err, rows) => {
                if (err)
                    return reject(err);
                resolve(rows || []);
            });
        }
        catch (e) {
            reject(e);
        }
    });
}
exports.getOutcomesByProject = getOutcomesByProject;
exports.default = {
    insertOutcome,
    getOutcomesByDispatch,
    getOutcomesByProject,
};

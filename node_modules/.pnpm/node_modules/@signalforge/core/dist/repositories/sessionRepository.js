"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionById = exports.getActiveSessionByProject = exports.endSessionWithEvent = exports.createSessionWithEvent = exports.endSession = exports.createSession = void 0;
function createSession(db, row) {
    const sql = `INSERT INTO sessions(session_id, project_id, branch, status, started_at, ended_at, is_pinned) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    return new Promise((resolve, reject) => {
        db.run(sql, [row.session_id, row.project_id, row.branch || null, row.status || 'active', row.started_at, row.ended_at || null, row.is_pinned ? 1 : 0], (err) => {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT' || /constraint/i.test(err.message || ''))
                    return resolve();
                return reject(err);
            }
            resolve();
        });
    });
}
exports.createSession = createSession;
function endSession(db, sessionId, endedAt) {
    const sql = `UPDATE sessions SET ended_at = ?, status = ? WHERE session_id = ?`;
    return new Promise((resolve, reject) => {
        db.run(sql, [endedAt, 'closed', sessionId], (err) => {
            if (err)
                return reject(err);
            resolve();
        });
    });
}
exports.endSession = endSession;
// Emit session lifecycle events into chat_events to keep the event stream canonical
const helpers_1 = require("../events/helpers");
const chatEventRepository_1 = require("./chatEventRepository");
async function createSessionWithEvent(db, row) {
    await createSession(db, row);
    try {
        const evt = (0, helpers_1.createEvent)({
            thread_id: row.session_id,
            project_id: row.project_id,
            session_id: row.session_id,
            source: row.source || 'cli',
            role: 'system',
            event_type: 'session_started',
            content: { summary: `Session started for project ${row.project_id}` },
        });
        await (0, chatEventRepository_1.insertChatEvent)(db, {
            chat_thread_id: evt.thread_id,
            project_id: evt.project_id,
            session_id: evt.session_id,
            dispatch_id: evt.dispatch_id,
            source: evt.source,
            role: evt.role,
            event_type: evt.event_type,
            content: JSON.stringify(evt.content),
            created_at: evt.timestamp,
        });
    }
    catch (e) {
        // best-effort
    }
}
exports.createSessionWithEvent = createSessionWithEvent;
async function endSessionWithEvent(db, sessionId, endedAt) {
    await endSession(db, sessionId, endedAt);
    try {
        const row = await getSessionById(db, sessionId);
        if (!row || !row.project_id) {
            throw new Error('Cannot end session event without project_id');
        }
        const evt = (0, helpers_1.createEvent)({
            thread_id: sessionId,
            project_id: row.project_id,
            session_id: sessionId,
            source: 'cli',
            role: 'system',
            event_type: 'session_ended',
            content: { summary: `Session ended at ${endedAt}` },
        });
        await (0, chatEventRepository_1.insertChatEvent)(db, {
            chat_thread_id: evt.thread_id,
            project_id: evt.project_id,
            session_id: evt.session_id,
            dispatch_id: evt.dispatch_id,
            source: evt.source,
            role: evt.role,
            event_type: evt.event_type,
            content: JSON.stringify(evt.content),
            created_at: evt.timestamp,
        });
    }
    catch (e) {
        // best-effort
    }
}
exports.endSessionWithEvent = endSessionWithEvent;
function getActiveSessionByProject(db, projectId) {
    const sql = `SELECT * FROM sessions WHERE project_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1`;
    return new Promise((resolve, reject) => {
        db.all(sql, [projectId, 'active'], (err, rows) => {
            if (err)
                return reject(err);
            resolve((rows && rows[0]) || null);
        });
    });
}
exports.getActiveSessionByProject = getActiveSessionByProject;
function getSessionById(db, sessionId) {
    const sql = `SELECT * FROM sessions WHERE session_id = ? LIMIT 1`;
    return new Promise((resolve, reject) => {
        db.all(sql, [sessionId], (err, rows) => {
            if (err)
                return reject(err);
            resolve((rows && rows[0]) || null);
        });
    });
}
exports.getSessionById = getSessionById;
exports.default = {
    createSession,
    endSession,
    getActiveSessionByProject,
    getSessionById,
};

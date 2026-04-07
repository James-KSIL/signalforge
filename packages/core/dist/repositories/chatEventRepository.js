"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatEventsByThread = exports.insertChatEvent = void 0;
const helpers_1 = require("../events/helpers");
function insertChatEvent(db, row) {
    const sql = `INSERT INTO chat_events(event_id, chat_thread_id, project_id, session_id, dispatch_id, source, turn_index, role, event_type, content, artifact_refs, source_url, matched_trigger, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    // Coerce/validate into canonical ForgeEvent-like shape before storage
    const contentObj = typeof row.content === 'string' ? (() => {
        try {
            return JSON.parse(row.content);
        }
        catch {
            return { summary: String(row.content || '') };
        }
    })() : (row.content || { summary: '' });
    const evt = (0, helpers_1.createEvent)({
        thread_id: row.chat_thread_id,
        project_id: row.project_id,
        session_id: row.session_id || undefined,
        dispatch_id: row.dispatch_id || undefined,
        source: row.source || 'cli',
        role: row.role,
        event_type: row.event_type,
        content: contentObj,
    });
    // store stringified content to maintain DB TEXT column compatibility
    const storedContent = JSON.stringify(evt.content);
    const storedArtifactRefs = Array.isArray(evt.content.artifact_refs) && evt.content.artifact_refs.length
        ? JSON.stringify(evt.content.artifact_refs)
        : null;
    // log and assert before DB insert to enforce canonical write paths
    console.log('insertChatEvent: preparing to insert event', { event_id: evt.event_id, thread_id: evt.thread_id, project_id: evt.project_id, dispatch_id: evt.dispatch_id, role: evt.role, event_type: evt.event_type });
    return new Promise((resolve, reject) => {
        db.run(sql, [
            evt.event_id,
            evt.thread_id,
            evt.project_id,
            evt.session_id || null,
            evt.dispatch_id || null,
            evt.source,
            row.turn_index || 0,
            evt.role,
            evt.event_type,
            storedContent,
            storedArtifactRefs,
            row.source_url || null,
            row.matched_trigger || null,
            evt.timestamp,
        ], (err) => {
            if (err) {
                // idempotency: ignore constraint error
                if (err.code === 'SQLITE_CONSTRAINT' || /constraint/i.test(err.message || ''))
                    return resolve();
                return reject(err);
            }
            resolve();
        });
    });
}
exports.insertChatEvent = insertChatEvent;
function getChatEventsByThread(db, chatThreadId) {
    const sql = `SELECT * FROM chat_events WHERE chat_thread_id = ? ORDER BY created_at ASC`;
    return new Promise((resolve, reject) => {
        if (typeof db.all === 'function') {
            db.all(sql, [chatThreadId], (err, rows) => {
                if (err)
                    return reject(err);
                resolve(rows || []);
            });
        }
        else if (typeof db.prepare === 'function') {
            // sqlite3 Database
            db.all(sql, [chatThreadId], (err, rows) => {
                if (err)
                    return reject(err);
                resolve(rows || []);
            });
        }
        else {
            // unknown DB interface
            resolve([]);
        }
    });
}
exports.getChatEventsByThread = getChatEventsByThread;

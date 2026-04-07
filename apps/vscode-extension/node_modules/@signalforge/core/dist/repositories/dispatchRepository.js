"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestDispatch = void 0;
function getLatestDispatch(db) {
    const sql = `SELECT chat_thread_id, dispatch_id, project_id, created_at FROM chat_events WHERE event_type = ? ORDER BY created_at DESC LIMIT 1`;
    return new Promise((resolve, reject) => {
        if (typeof db.all === 'function') {
            db.all(sql, ['dispatch_candidate_created'], (err, rows) => {
                if (err)
                    return reject(err);
                return resolve(rows && rows[0] ? rows[0] : null);
            });
        }
        else {
            try {
                db.all(sql, ['dispatch_candidate_created'], (err, rows) => {
                    if (err)
                        return reject(err);
                    return resolve(rows && rows[0] ? rows[0] : null);
                });
            }
            catch (e) {
                return reject(e);
            }
        }
    });
}
exports.getLatestDispatch = getLatestDispatch;
exports.default = { getLatestDispatch };

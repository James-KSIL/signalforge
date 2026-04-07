export function getLatestDispatch(db: any): Promise<{ chat_thread_id: string; dispatch_id?: string; project_id?: string; created_at: string } | null> {
  const sql = `SELECT chat_thread_id, dispatch_id, project_id, created_at FROM chat_events WHERE event_type = ? ORDER BY created_at DESC LIMIT 1`;
  return new Promise((resolve, reject) => {
    if (typeof db.all === 'function') {
      db.all(sql, ['dispatch_candidate_created'], (err: any, rows: any[]) => {
        if (err) return reject(err);
        return resolve(rows && rows[0] ? rows[0] : null);
      });
    } else {
      try {
        db.all(sql, ['dispatch_candidate_created'], (err: any, rows: any[]) => {
          if (err) return reject(err);
          return resolve(rows && rows[0] ? rows[0] : null);
        });
      } catch (e) {
        return reject(e);
      }
    }
  });
}

export default { getLatestDispatch };

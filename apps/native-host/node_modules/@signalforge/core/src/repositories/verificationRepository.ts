export type ChatGPTVerificationEventRow = {
  verification_id: string;
  project_id: string;
  session_id: string;
  dispatch_id: string | null;
  thread_id: string;
  turn_id: string;
  captured_at: string;
  raw_text: string;
  classification_signals_json: string;
  source: 'chatgpt';
};

function dbRun(db: any, sql: string, params: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function dbAll<T>(db: any, sql: string, params: any[]): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: any, rows: T[]) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

export async function insertChatGPTVerificationEvent(db: any, row: ChatGPTVerificationEventRow): Promise<void> {
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
  } catch (err: any) {
    if ((err as any).code === 'SQLITE_CONSTRAINT' || /constraint/i.test((err as any).message || '')) {
      return;
    }
    throw err;
  }
}

export async function getLatestChatGPTVerificationEvent(
  db: any,
  projectId: string,
  sessionId: string
): Promise<ChatGPTVerificationEventRow | null> {
  const sql = `SELECT * FROM chatgpt_verification_events
    WHERE project_id = ? AND session_id = ?
    ORDER BY captured_at DESC
    LIMIT 1`;
  const rows = await dbAll<ChatGPTVerificationEventRow>(db, sql, [projectId, sessionId]);
  return rows[0] || null;
}

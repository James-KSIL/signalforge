export type OutcomeLogRow = {
  outcome_id: string;
  project_id: string;
  session_id: string;
  dispatch_id: string;
  candidate_id: string | null;
  created_at: string;
  contract_ref: string | null;
  artifact_ref: string | null;
  verification_ref: string | null;
  rejection_reason: string | null;
  outcome_summary: string;
  outcome_status: 'success' | 'partial' | 'failed';
  source: 'auto';
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

export async function insertOutcomeLog(db: any, row: OutcomeLogRow): Promise<void> {
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
  } catch (err: any) {
    if ((err as any).code === 'SQLITE_CONSTRAINT' || /constraint/i.test((err as any).message || '')) {
      return;
    }
    throw err;
  }
}

export async function getLatestOutcomeLog(db: any, projectId: string, sessionId: string): Promise<OutcomeLogRow | null> {
  const sql = `SELECT * FROM outcome_logs
    WHERE project_id = ? AND session_id = ?
    ORDER BY created_at DESC
    LIMIT 1`;
  const rows = await dbAll<OutcomeLogRow>(db, sql, [projectId, sessionId]);
  return rows[0] || null;
}

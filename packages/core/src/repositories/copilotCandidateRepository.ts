export type CandidateValidationStatus = 'pending' | 'rejected' | 'promoted';

export type CopilotCandidateStagingRow = {
  candidate_id: string;
  project_id: string;
  session_id: string;
  dispatch_id: string | null;
  contract_ref: string | null;
  captured_at: string;
  source: string;
  raw_text: string;
  content_hash: string | null;
  signal_flags_json: string;
  capture_context_json: string | null;
  diagnostic_score: number | null;
  gate_pass: number | null;
  gate_failure_reason: string | null;
  failed_invariants_json: string | null;
  validation_status: CandidateValidationStatus;
  rejection_reason: string | null;
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

export async function insertCopilotCandidateStaging(db: any, row: CopilotCandidateStagingRow): Promise<void> {
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
  } catch (err: any) {
    if ((err as any).code === 'SQLITE_CONSTRAINT' || /constraint/i.test((err as any).message || '')) {
      return;
    }
    throw err;
  }
}

export async function updateCopilotCandidateStatus(
  db: any,
  candidateId: string,
  status: CandidateValidationStatus,
  rejectionReason: string | null
): Promise<void> {
  const sql = `UPDATE copilot_candidate_staging
    SET validation_status = ?, rejection_reason = ?
    WHERE candidate_id = ?`;
  await dbRun(db, sql, [status, rejectionReason, candidateId]);
}

export async function updateCopilotCandidateEvaluation(
  db: any,
  candidateId: string,
  updates: {
    diagnosticScore: number | null;
    gatePass: boolean;
    gateFailureReason: string | null;
    failedInvariantsJson: string | null;
  }
): Promise<void> {
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

export async function getCopilotCandidateById(db: any, candidateId: string): Promise<CopilotCandidateStagingRow | null> {
  const sql = 'SELECT * FROM copilot_candidate_staging WHERE candidate_id = ? LIMIT 1';
  const rows = await dbAll<CopilotCandidateStagingRow>(db, sql, [candidateId]);
  return rows[0] || null;
}

export async function getRecentCopilotCandidates(
  db: any,
  projectId: string,
  sessionId?: string,
  limit: number = 40
): Promise<CopilotCandidateStagingRow[]> {
  const normalizedLimit = Math.max(1, Math.min(200, limit));
  if (sessionId && String(sessionId).trim()) {
    const sql = `SELECT * FROM copilot_candidate_staging
      WHERE project_id = ? AND session_id = ?
      ORDER BY captured_at DESC
      LIMIT ${normalizedLimit}`;
    return dbAll<CopilotCandidateStagingRow>(db, sql, [projectId, sessionId]);
  }

  const sql = `SELECT * FROM copilot_candidate_staging
    WHERE project_id = ?
    ORDER BY captured_at DESC
    LIMIT ${normalizedLimit}`;
  return dbAll<CopilotCandidateStagingRow>(db, sql, [projectId]);
}

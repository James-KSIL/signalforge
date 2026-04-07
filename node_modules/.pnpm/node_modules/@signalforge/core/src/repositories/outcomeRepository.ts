export function insertOutcome(db: any, row: any): Promise<void> {
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
      ], (err: any) => {
        if (err) {
          // ignore constraint errors
          if ((err as any).code === 'SQLITE_CONSTRAINT' || /constraint/i.test((err as any).message || '')) return resolve();
          return reject(err);
        }
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Also write a canonical chat_event record for the outcome so ADR/session
// generators can rely on event streams.
import { buildOutcomeEvent } from '../events/outcome';
import { insertChatEvent } from './chatEventRepository';
import { toDispatchId } from '../events/helpers';

function normalizeOutcomeStatus(status: any): 'success' | 'partial' | 'fail' {
  if (status === 'success' || status === 'partial' || status === 'fail') return status;
  if (status === 'failed' || status === 'blocked') return 'fail';
  return 'partial';
}

export async function insertOutcomeWithEvent(db: any, row: any): Promise<void> {
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
    const outcomeEvent = buildOutcomeEvent(resolvedThreadId, {
      projectId: row.project_id,
      sessionId: row.session_id || undefined,
      dispatchId: toDispatchId(row.dispatch_thread_id || resolvedThreadId),
      source: row.source || 'cli',
      status: normalizeOutcomeStatus(row.status),
      title: row.title,
      whatChanged: row.what_changed || '',
      resistance: row.what_broke || undefined,
      nextStep: row.next_step || '',
    });

    await insertChatEvent(db, {
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
    } as any);
  } catch (e) {
    // best-effort: do not fail outcome insertion for event emission failures
  }
}

export function getOutcomesByDispatch(db: any, dispatchThreadId: string): Promise<any[]> {
  const sql = `SELECT * FROM outcomes WHERE dispatch_thread_id = ? ORDER BY created_at ASC`;
  return new Promise((resolve, reject) => {
    try {
      db.all(sql, [dispatchThreadId], (err: any, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function getOutcomesByProject(db: any, projectId: string): Promise<any[]> {
  const sql = `SELECT * FROM outcomes WHERE project_id = ? ORDER BY created_at ASC`;
  return new Promise((resolve, reject) => {
    try {
      db.all(sql, [projectId], (err: any, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } catch (e) {
      reject(e);
    }
  });
}

export default {
  insertOutcome,
  getOutcomesByDispatch,
  getOutcomesByProject,
};

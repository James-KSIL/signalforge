import crypto from 'crypto';
import path from 'path';

export function deriveProjectIdFromPath(workspacePath: string): string {
  const norm = path.resolve(workspacePath || '').toLowerCase();
  const hash = crypto.createHash('sha1').update(norm).digest('hex');
  return `proj_${hash.slice(0, 12)}`;
}

export function deriveProjectId(workspacePath: string, alias?: string | null): string {
  const norm = path.resolve(workspacePath || '').toLowerCase();
  const cleanedAlias = (alias || '').trim().toLowerCase();
  const identity = cleanedAlias ? `${norm}::${cleanedAlias}` : norm;
  const hash = crypto.createHash('sha1').update(identity).digest('hex');
  return `proj_${hash.slice(0, 12)}`;
}

export async function ensureProjectRecord(db: any, projectId: string, name: string, gitRoot: string, workspaceUri: string): Promise<void> {
  if (!db) return;
  const now = new Date().toISOString();
  try {
    // try sqlite3 style run
    const sql = `INSERT OR IGNORE INTO projects (project_id, name, git_root, workspace_uri, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;
    if (db.run) {
      db.run(sql, [projectId, name || projectId, gitRoot || workspaceUri || '', workspaceUri || '', now, now], () => {});
    }
  } catch (e) {
    // best-effort, ignore errors
  }
}

export default {
  deriveProjectId,
  deriveProjectIdFromPath,
  ensureProjectRecord,
};

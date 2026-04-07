"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureProjectRecord = exports.deriveProjectId = exports.deriveProjectIdFromPath = void 0;
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
function deriveProjectIdFromPath(workspacePath) {
    const norm = path_1.default.resolve(workspacePath || '').toLowerCase();
    const hash = crypto_1.default.createHash('sha1').update(norm).digest('hex');
    return `proj_${hash.slice(0, 12)}`;
}
exports.deriveProjectIdFromPath = deriveProjectIdFromPath;
function deriveProjectId(workspacePath, alias) {
    const norm = path_1.default.resolve(workspacePath || '').toLowerCase();
    const cleanedAlias = (alias || '').trim().toLowerCase();
    const identity = cleanedAlias ? `${norm}::${cleanedAlias}` : norm;
    const hash = crypto_1.default.createHash('sha1').update(identity).digest('hex');
    return `proj_${hash.slice(0, 12)}`;
}
exports.deriveProjectId = deriveProjectId;
async function ensureProjectRecord(db, projectId, name, gitRoot, workspaceUri) {
    if (!db)
        return;
    const now = new Date().toISOString();
    try {
        // try sqlite3 style run
        const sql = `INSERT OR IGNORE INTO projects (project_id, name, git_root, workspace_uri, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;
        if (db.run) {
            db.run(sql, [projectId, name || projectId, gitRoot || workspaceUri || '', workspaceUri || '', now, now], () => { });
        }
    }
    catch (e) {
        // best-effort, ignore errors
    }
}
exports.ensureProjectRecord = ensureProjectRecord;
exports.default = {
    deriveProjectId,
    deriveProjectIdFromPath,
    ensureProjectRecord,
};

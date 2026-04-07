"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleInbound = exports.drainBootstrapAuthoritySignal = exports.getBootstrapSignalDbPath = exports.getBootstrapSignalFilePath = exports.closeNativeHostDatabase = void 0;
const db_1 = require("@signalforge/core/dist/storage/db");
const validateIncomingMessage_1 = require("@signalforge/core/dist/validation/validateIncomingMessage");
const ingestChatEvent_1 = require("@signalforge/core/dist/ingestion/ingestChatEvent");
const ingestArtifactBound_1 = require("@signalforge/core/dist/ingestion/ingestArtifactBound");
const copilotCandidateRepository_1 = require("@signalforge/core/dist/repositories/copilotCandidateRepository");
const copilotArtifactRepository_1 = require("@signalforge/core/dist/repositories/copilotArtifactRepository");
const verificationRepository_1 = require("@signalforge/core/dist/repositories/verificationRepository");
const outcomeLogRepository_1 = require("@signalforge/core/dist/repositories/outcomeLogRepository");
const copilotValidationService_1 = require("@signalforge/core/dist/validation/copilotValidationService");
const sessionRepository_1 = require("@signalforge/core/dist/repositories/sessionRepository");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let nativeHostDb = null;
let nativeHostSchemaReady = false;
async function ensureNativeHostDb() {
    if (!nativeHostDb) {
        nativeHostDb = (0, db_1.openDatabase)();
        nativeHostSchemaReady = false;
    }
    if (!nativeHostSchemaReady) {
        await (0, db_1.initSchema)(nativeHostDb);
        nativeHostSchemaReady = true;
    }
    return nativeHostDb;
}
function closeNativeHostDatabase() {
    return new Promise((resolve) => {
        const db = nativeHostDb;
        nativeHostDb = null;
        nativeHostSchemaReady = false;
        if (!db || typeof db.close !== 'function') {
            resolve();
            return;
        }
        try {
            db.close((err) => {
                if (err) {
                    console.error('[SignalForge] native-host db close error', err);
                }
                resolve();
            });
        }
        catch (err) {
            console.error('[SignalForge] native-host db close threw', err);
            resolve();
        }
    });
}
exports.closeNativeHostDatabase = closeNativeHostDatabase;
function accept(messageId) {
    return { type: 'ack', message_id: messageId, status: 'accepted' };
}
function reject(messageId, reason) {
    return { type: 'error', message_id: messageId, reason };
}
function warnAndAck(messageId, warning) {
    console.warn('[SignalForge] native-host ingest warning', { message_id: messageId, warning });
    return accept(messageId);
}
let cachedBootstrapAuthority = null;
const BOOTSTRAP_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const BOOTSTRAP_SIGNAL_FRESH_MS = 60 * 1000;
let lastSignalTimestampSeen = '';
const workspaceRootHintsByProject = new Map();
let hasLoggedContentHashOverrideActivation = false;
function computeContentHash(text) {
    return `sha256_${crypto_1.default.createHash('sha256').update(String(text || ''), 'utf8').digest('hex')}`;
}
function resolveCandidateSource(rawSource) {
    return typeof rawSource === 'string' ? rawSource : '';
}
function isTestRunnerProcess() {
    const execArgv = Array.isArray(process.execArgv) ? process.execArgv : [];
    if (execArgv.includes('--test'))
        return true;
    if (typeof process.env.NODE_TEST_CONTEXT === 'string' && process.env.NODE_TEST_CONTEXT.trim()) {
        return true;
    }
    // Compatibility with common JS test runners.
    if (typeof process.env.JEST_WORKER_ID === 'string' && process.env.JEST_WORKER_ID.trim())
        return true;
    if (typeof process.env.VITEST === 'string' && process.env.VITEST.trim())
        return true;
    if (typeof process.env.MOCHA === 'string' && process.env.MOCHA.trim())
        return true;
    return false;
}
function resolveCandidateContentHash(inbound) {
    const allowOverride = process.env.SIGNALFORGE_ALLOW_CONTENT_HASH_OVERRIDE === '1'
        && isTestRunnerProcess();
    if (allowOverride && !hasLoggedContentHashOverrideActivation) {
        hasLoggedContentHashOverrideActivation = true;
        console.error('[SignalForge][SECURITY][CONTENT_HASH_OVERRIDE_ACTIVE] test-only override is active in test context', {
            pid: process.pid,
            nodeTestContext: process.env.NODE_TEST_CONTEXT || null,
            nodeUniqueId: process.env.NODE_UNIQUE_ID || null,
            execArgv: process.execArgv,
        });
    }
    if (allowOverride && Object.prototype.hasOwnProperty.call(inbound || {}, 'content_hash')) {
        const override = inbound?.content_hash;
        if (typeof override === 'string') {
            return override;
        }
        return null;
    }
    return computeContentHash(inbound?.raw_text);
}
const BOOTSTRAP_SIGNAL_FILE = process.env.SIGNALFORGE_BOOTSTRAP_SIGNAL_FILE?.trim()
    || path_1.default.join(path_1.default.dirname((0, db_1.getDefaultDbPath)()), 'bootstrap-authority-event.json');
function getBootstrapSignalFilePath() {
    return BOOTSTRAP_SIGNAL_FILE;
}
exports.getBootstrapSignalFilePath = getBootstrapSignalFilePath;
function getBootstrapSignalDbPath() {
    return (0, db_1.getDefaultDbPath)();
}
exports.getBootstrapSignalDbPath = getBootstrapSignalDbPath;
function normalizeWorkspaceRoot(value) {
    if (typeof value !== 'string')
        return null;
    const normalized = value.trim();
    if (!normalized)
        return null;
    const lower = normalized.toLowerCase();
    if (lower.startsWith('proj_'))
        return null;
    if (!/[\\/]|^[a-z]:/i.test(normalized))
        return null;
    return normalized;
}
function rememberWorkspaceRoot(projectId, workspaceRoot) {
    const normalizedProjectId = String(projectId || '').trim();
    const normalizedWorkspaceRoot = normalizeWorkspaceRoot(workspaceRoot);
    if (!normalizedProjectId || !normalizedWorkspaceRoot)
        return;
    workspaceRootHintsByProject.set(normalizedProjectId, normalizedWorkspaceRoot);
}
async function getWorkspaceRootFromProjectRecord(db, projectId) {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId || !db || typeof db.get !== 'function') {
        return undefined;
    }
    return await new Promise((resolve) => {
        db.get('SELECT workspace_uri, git_root FROM projects WHERE project_id = ? LIMIT 1', [normalizedProjectId], (err, row) => {
            if (err || !row) {
                resolve(undefined);
                return;
            }
            const resolved = normalizeWorkspaceRoot(row.workspace_uri) || normalizeWorkspaceRoot(row.git_root) || undefined;
            resolve(resolved);
        });
    });
}
function getWorkspaceRootFromBootstrapSignal(projectId) {
    try {
        if (!fs_1.default.existsSync(BOOTSTRAP_SIGNAL_FILE)) {
            return undefined;
        }
        const raw = fs_1.default.readFileSync(BOOTSTRAP_SIGNAL_FILE, 'utf8');
        if (!raw || !raw.trim()) {
            return undefined;
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.project_id || '').trim() !== String(projectId || '').trim()) {
            return undefined;
        }
        return normalizeWorkspaceRoot(parsed?.workspace_root) || undefined;
    }
    catch {
        return undefined;
    }
}
async function resolveWorkspaceRootForProject(db, projectId) {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId)
        return undefined;
    const hinted = workspaceRootHintsByProject.get(normalizedProjectId);
    if (hinted) {
        return hinted;
    }
    if (cachedBootstrapAuthority && cachedBootstrapAuthority.project_id === normalizedProjectId) {
        const cachedRoot = normalizeWorkspaceRoot(cachedBootstrapAuthority.workspace_root);
        if (cachedRoot) {
            rememberWorkspaceRoot(normalizedProjectId, cachedRoot);
            return cachedRoot;
        }
    }
    const signalRoot = getWorkspaceRootFromBootstrapSignal(normalizedProjectId);
    if (signalRoot) {
        rememberWorkspaceRoot(normalizedProjectId, signalRoot);
        return signalRoot;
    }
    const dbRoot = await getWorkspaceRootFromProjectRecord(db, normalizedProjectId);
    if (dbRoot) {
        rememberWorkspaceRoot(normalizedProjectId, dbRoot);
        return dbRoot;
    }
    return undefined;
}
function setBootstrapAuthority(msg) {
    try {
        const timestamp = typeof msg.timestamp === 'string' && msg.timestamp.trim().length > 0
            ? msg.timestamp
            : new Date().toISOString();
        console.error('[SignalForge] bootstrap authority received', { project_id: msg.project_id, project_label: msg.project_label, authority: msg.authority || 'vscode' });
        cachedBootstrapAuthority = {
            project_id: msg.project_id,
            project_label: msg.project_label,
            authority: msg.authority || 'vscode',
            timestamp,
            workspace_root: normalizeWorkspaceRoot(msg.workspace_root),
            session_id: msg.session_id || null,
            dispatch_id: msg.dispatch_id || null,
        };
        rememberWorkspaceRoot(msg.project_id, msg.workspace_root);
        lastSignalTimestampSeen = timestamp;
        console.error('[SignalForge] bootstrap authority cached', { project_id: msg.project_id, authority: msg.authority || 'vscode' });
        return accept(msg.message_id || 'msg_bootstrap');
    }
    catch (err) {
        return reject(msg.message_id || 'msg_bootstrap', String(err));
    }
}
function drainBootstrapAuthoritySignal() {
    try {
        console.error('[SignalForge] bootstrap authority poll tick', { signal_file: BOOTSTRAP_SIGNAL_FILE });
        if (!fs_1.default.existsSync(BOOTSTRAP_SIGNAL_FILE)) {
            console.error('[SignalForge] bootstrap authority signal missing', { signal_file: BOOTSTRAP_SIGNAL_FILE });
            return null;
        }
        const raw = fs_1.default.readFileSync(BOOTSTRAP_SIGNAL_FILE, 'utf8');
        console.error('[SignalForge] bootstrap authority signal read', { signal_file: BOOTSTRAP_SIGNAL_FILE, bytes: raw.length });
        if (!raw || !raw.trim()) {
            console.error('[SignalForge] bootstrap authority signal empty', { signal_file: BOOTSTRAP_SIGNAL_FILE });
            return null;
        }
        const parsed = JSON.parse(raw);
        if (parsed?.type !== 'bootstrap_authority' ||
            typeof parsed?.project_id !== 'string' ||
            typeof parsed?.project_label !== 'string' ||
            typeof parsed?.timestamp !== 'string') {
            console.error('[SignalForge] bootstrap authority signal ignored', {
                signal_file: BOOTSTRAP_SIGNAL_FILE,
                reason: 'invalid_shape',
            });
            return null;
        }
        if (parsed.timestamp === lastSignalTimestampSeen) {
            console.error('[SignalForge] bootstrap authority signal ignored', {
                signal_file: BOOTSTRAP_SIGNAL_FILE,
                reason: 'duplicate_timestamp',
                timestamp: parsed.timestamp,
            });
            return null;
        }
        const signalAge = Date.now() - new Date(parsed.timestamp).getTime();
        if (!Number.isFinite(signalAge) || signalAge > BOOTSTRAP_SIGNAL_FRESH_MS) {
            console.error('[SignalForge] bootstrap authority signal ignored', {
                signal_file: BOOTSTRAP_SIGNAL_FILE,
                reason: 'stale',
                timestamp: parsed.timestamp,
                signalAge,
            });
            return null;
        }
        const normalized = {
            type: 'bootstrap_authority',
            project_id: parsed.project_id,
            project_label: parsed.project_label,
            authority: parsed.authority || 'vscode',
            timestamp: parsed.timestamp,
            workspace_root: normalizeWorkspaceRoot(parsed.workspace_root),
            source: 'signal_file_poll',
        };
        console.error('[SignalForge] bootstrap authority received', { project_id: normalized.project_id, project_label: normalized.project_label, authority: normalized.authority, source: 'signal_file' });
        cachedBootstrapAuthority = {
            project_id: normalized.project_id,
            project_label: normalized.project_label,
            authority: normalized.authority,
            timestamp: normalized.timestamp,
            workspace_root: normalized.workspace_root,
        };
        rememberWorkspaceRoot(normalized.project_id, normalized.workspace_root);
        lastSignalTimestampSeen = normalized.timestamp;
        console.error('[SignalForge] bootstrap authority cached', { project_id: normalized.project_id, authority: normalized.authority });
        return normalized;
    }
    catch {
        console.error('[SignalForge] bootstrap authority poll failed', { signal_file: BOOTSTRAP_SIGNAL_FILE });
        return null;
    }
}
exports.drainBootstrapAuthoritySignal = drainBootstrapAuthoritySignal;
async function getBootstrapAuthority(msg) {
    // Fallback path: called when Chrome init queries or on recovery
    // Returns cached authority if available (set via push from VS Code), or queries DB for recent bootstrap
    try {
        const now = new Date().getTime();
        const cached = cachedBootstrapAuthority;
        if (cached) {
            const age = now - new Date(cached.timestamp).getTime();
            if (age < BOOTSTRAP_CACHE_TTL_MS) {
                console.error('[SignalForge] bootstrap authority returned to chrome', { project_id: cached.project_id, source: 'memory_cache' });
                return {
                    type: 'bootstrap_authority',
                    message_id: msg.message_id || 'msg_bootstrap_query',
                    ...cached,
                    source: 'memory_cache',
                };
            }
        }
        // Also check core DB for recent bootstrap marker (fallback to DB if cache expired)
        try {
            const db = await ensureNativeHostDb();
            const recentProject = await new Promise((resolve, reject) => {
                if (!db || typeof db.get !== 'function') {
                    resolve(null);
                    return;
                }
                db.get('SELECT project_id, name, updated_at, workspace_uri, git_root FROM projects ORDER BY updated_at DESC LIMIT 1', [], (err, row) => {
                    if (err)
                        return reject(err);
                    resolve(row || null);
                });
            });
            if (recentProject && recentProject.updated_at) {
                const updatedTime = new Date(recentProject.updated_at).getTime();
                const timeSinceUpdate = now - updatedTime;
                // If project was updated very recently (< 60 seconds), it's likely from bootstrap.
                // This is last-resort recovery only — not primary authority inference.
                if (timeSinceUpdate < 60 * 1000) {
                    console.error('[SignalForge] bootstrap authority returned to chrome', { project_id: recentProject.project_id, source: 'db_fallback' });
                    return {
                        type: 'bootstrap_authority',
                        message_id: msg.message_id || 'msg_bootstrap_query',
                        project_id: recentProject.project_id,
                        project_label: recentProject.name,
                        authority: 'vscode',
                        timestamp: recentProject.updated_at,
                        workspace_root: normalizeWorkspaceRoot(recentProject.workspace_uri) || normalizeWorkspaceRoot(recentProject.git_root) || null,
                        session_id: null,
                        dispatch_id: null,
                        source: 'db_fallback',
                    };
                }
            }
        }
        catch (dbErr) {
            // DB check is optional; continue to null response
        }
        return {
            type: 'bootstrap_authority',
            message_id: msg.message_id || 'msg_bootstrap_query',
            project_id: null,
            project_label: null,
            authority: null,
            session_id: null,
            dispatch_id: null,
            source: 'bootstrap_query_empty',
        };
    }
    catch (err) {
        return reject(msg.message_id || 'msg_bootstrap_query', String(err));
    }
}
function resolveMessageId(parsed, payload) {
    return parsed.message_id || payload?.eventId || payload?.candidate_id || payload?.chat_id || 'msg_unknown';
}
function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function computeTextHash(text) {
    const normalized = normalizeText(text);
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i += 1) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `fnv1a_${(hash >>> 0).toString(16)}`;
}
function tokenOverlapRatio(a, b) {
    const aTokens = new Set(normalizeText(a).split(/[^a-z0-9_]+/).filter(Boolean));
    const bTokens = new Set(normalizeText(b).split(/[^a-z0-9_]+/).filter(Boolean));
    if (!aTokens.size || !bTokens.size)
        return 0;
    let intersection = 0;
    for (const token of aTokens.values()) {
        if (bTokens.has(token))
            intersection += 1;
    }
    return intersection / Math.max(aTokens.size, bTokens.size);
}
function asIso(value) {
    return value && String(value).trim() ? String(value) : new Date().toISOString();
}
function dbAll(db, sql, params) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                return reject(err);
            resolve(rows || []);
        });
    });
}
async function resolveSessionAndDispatchContext(db, payload) {
    let sessionId = payload.session_id;
    let dispatchId = payload.dispatch_id || null;
    if (!sessionId || sessionId === 'session_unbound') {
        const active = await (0, sessionRepository_1.getActiveSessionByProject)(db, payload.project_id);
        if (active?.session_id) {
            sessionId = String(active.session_id);
        }
    }
    if (!dispatchId) {
        const rows = await dbAll(db, `SELECT dispatch_id FROM chat_events
       WHERE event_type = ? AND project_id = ?
       ORDER BY created_at DESC LIMIT 1`, ['dispatch_candidate_created', payload.project_id]);
        dispatchId = rows[0]?.dispatch_id || null;
    }
    return {
        sessionId: sessionId || 'session_unbound',
        dispatchId,
    };
}
async function resolveLatestDispatchForProject(db, projectId, sessionId) {
    const rows = await dbAll(db, `SELECT dispatch_id FROM chat_events
     WHERE project_id = ?
       AND (session_id = ? OR session_id IS NULL)
       AND dispatch_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`, [projectId, sessionId]);
    return rows[0]?.dispatch_id || null;
}
async function emitValidationLifecycleEvent(db, eventType, payload) {
    await (0, ingestChatEvent_1.ingestChatEvent)(db, {
        chat_thread_id: payload.session_id,
        turn_index: 0,
        role: 'observer',
        event_type: eventType,
        source: 'browser',
        project_id: payload.project_id,
        session_id: payload.session_id,
        dispatch_id: payload.dispatch_id || null,
        content: JSON.stringify({
            summary: payload.summary_reason,
            project_id: payload.project_id,
            session_id: payload.session_id,
            dispatch_id: payload.dispatch_id || null,
            candidate_id: payload.candidate_id,
            artifact_id: payload.artifact_id || null,
            timestamp: payload.timestamp,
            reasons: payload.reasons || [],
        }),
        created_at: payload.timestamp,
    });
}
async function emitOutcomeForValidationResult(db, eventType, payload) {
    try {
        const outcomeId = `out_${crypto_1.default.randomBytes(8).toString('hex')}`;
        let outcomeStatus;
        let artifactRef = null;
        let rejectionReason = null;
        if (eventType === 'copilot_implementation_validated') {
            outcomeStatus = 'success';
            artifactRef = payload.artifact_id || null;
        }
        else {
            // copilot_candidate_rejected
            outcomeStatus = 'failed';
            artifactRef = null;
            rejectionReason = payload.summary_reason;
        }
        const outcomeSummary = `${eventType}: ${payload.summary_reason}`;
        await (0, outcomeLogRepository_1.insertOutcomeLog)(db, {
            outcome_id: outcomeId,
            project_id: payload.project_id,
            session_id: payload.session_id,
            dispatch_id: String(payload.dispatch_id || 'dispatch_unbound'),
            candidate_id: payload.candidate_id,
            created_at: payload.timestamp,
            contract_ref: payload.contract_ref,
            artifact_ref: artifactRef,
            verification_ref: null,
            rejection_reason: rejectionReason,
            outcome_summary: outcomeSummary,
            outcome_status: outcomeStatus,
            source: 'auto',
        });
        console.log('[SignalForge] outcome_log emitted for validation result', {
            outcome_id: outcomeId,
            event_type: eventType,
            candidate_id: payload.candidate_id,
            artifact_ref: artifactRef,
            contract_ref: payload.contract_ref,
            rejection_reason: rejectionReason,
            outcome_status: outcomeStatus,
        });
    }
    catch (err) {
        console.error('[SignalForge] failed to emit outcome for validation result', {
            event_type: eventType,
            candidate_id: payload.candidate_id,
            error: String(err?.message || err),
        });
        // Don't throw - outcome logging failure should not block validation
    }
}
async function handleInbound(raw) {
    try {
        const parsed = raw;
        const payload = parsed.payload;
        const messageId = resolveMessageId(parsed, payload);
        if (payload.type === 'set_bootstrap_authority' || payload.type === 'bootstrap_authority') {
            return setBootstrapAuthority(payload);
        }
        if (payload.type === 'get_bootstrap_authority') {
            return await getBootstrapAuthority(payload);
        }
        const v = (0, validateIncomingMessage_1.validateInbound)(parsed);
        if (!v.ok)
            return reject(messageId, v.error || 'invalid_payload');
        if (payload.type === 'copy_binding_requested') {
            console.log('[SignalForge] copy_binding_requested processing at handler entry', {
                message_id: messageId,
                project_id: payload.project_id,
                chat_id: payload.chat_id,
                selection_type: payload.selection_type,
            });
            // Validate all required fields BEFORE processing
            try {
                const projectId = String(payload.project_id || '').trim();
                const chatId = String(payload.chat_id || '').trim();
                const copiedText = String(payload.copied_text || '').trim();
                const authority = String(payload.authority || 'browser_initiated').trim();
                const selectionType = String(payload.selection_type || 'manual').trim();
                const sourceUrl = String(payload.source_url || '').trim();
                const createdAt = String(payload.created_at || new Date().toISOString()).trim();
                // Validate required fields
                if (!projectId) {
                    const reason = 'copy_binding_requested rejected: project_id is required';
                    console.error('[SignalForge] ' + reason);
                    process.stderr.write('[SignalForge] copy_binding_requested validation error: project_id missing\n');
                    return reject(messageId, reason);
                }
                if (!chatId) {
                    const reason = 'copy_binding_requested rejected: chat_id is required';
                    console.error('[SignalForge] ' + reason);
                    process.stderr.write('[SignalForge] copy_binding_requested validation error: chat_id missing\n');
                    return reject(messageId, reason);
                }
                if (!copiedText) {
                    const reason = 'copy_binding_requested rejected: copied_text is required and non-empty';
                    console.error('[SignalForge] ' + reason);
                    process.stderr.write('[SignalForge] copy_binding_requested validation error: copied_text missing\n');
                    return reject(messageId, reason);
                }
                if (!sourceUrl) {
                    const reason = 'copy_binding_requested rejected: source_url is required';
                    console.error('[SignalForge] ' + reason);
                    process.stderr.write('[SignalForge] copy_binding_requested validation error: source_url missing\n');
                    return reject(messageId, reason);
                }
                // Validate selection_type enum
                if (selectionType !== 'manual' && selectionType !== 'canvas') {
                    const reason = `copy_binding_requested rejected: invalid selection_type "${selectionType}", expected 'manual' or 'canvas'`;
                    console.error('[SignalForge] ' + reason);
                    process.stderr.write('[SignalForge] copy_binding_requested validation error: ' + reason + '\n');
                    return reject(messageId, reason);
                }
                console.log('[SignalForge] copy_binding_requested validation passed', {
                    message_id: messageId,
                    project_id: projectId,
                    chat_id: chatId,
                    selection_type: selectionType,
                    copied_text_length: copiedText.length,
                });
                // Now safely call ingestArtifactBound with validated payload
                const db = await ensureNativeHostDb();
                const resolvedWorkspaceRoot = await resolveWorkspaceRootForProject(db, projectId);
                if (resolvedWorkspaceRoot) {
                    rememberWorkspaceRoot(projectId, resolvedWorkspaceRoot);
                }
                const activeSession = await (0, sessionRepository_1.getActiveSessionByProject)(db, projectId);
                const resolvedSessionId = String(activeSession?.session_id || '').trim();
                const resolvedDispatchId = resolvedSessionId
                    ? String((await resolveLatestDispatchForProject(db, projectId, resolvedSessionId)) || '').trim()
                    : '';
                if (!resolvedSessionId || !resolvedDispatchId) {
                    const reason = 'no active session or dispatch for project';
                    console.error('[SignalForge] copy_binding_requested rejected: no DB context', {
                        message_id: messageId,
                        project_id: projectId,
                        resolved_session_id: resolvedSessionId || null,
                        resolved_dispatch_id: resolvedDispatchId || null,
                    });
                    process.stderr.write('[SignalForge] copy_binding_requested error: ' + reason + '\n');
                    return reject(messageId, reason);
                }
                console.log('[SignalForge] copy_binding_requested resolved DB context', {
                    message_id: messageId,
                    project_id: projectId,
                    session_id: resolvedSessionId,
                    dispatch_id: resolvedDispatchId,
                    workspace_root: resolvedWorkspaceRoot || null,
                });
                try {
                    const boundEvent = {
                        type: 'artifact_bound',
                        chat_id: chatId,
                        project_id: projectId,
                        session_id: resolvedSessionId,
                        dispatch_id: resolvedDispatchId,
                        authority: authority,
                        copied_text: copiedText,
                        selection_type: selectionType,
                        source_url: sourceUrl,
                        created_at: createdAt,
                    };
                    await (0, ingestArtifactBound_1.ingestArtifactBound)(db, boundEvent);
                    console.log('[SignalForge] artifact_bound successfully ingested from copy_binding_requested', {
                        message_id: messageId,
                        project_id: projectId,
                        chat_id: chatId,
                    });
                    return accept(messageId);
                }
                catch (ingestError) {
                    const errorMsg = String(ingestError?.message || ingestError || 'unknown error');
                    console.error('[SignalForge] artifact_bound ingestion failed', {
                        message_id: messageId,
                        error: errorMsg,
                        project_id: projectId,
                        stack: String(ingestError?.stack || ''),
                    });
                    process.stderr.write('[SignalForge] artifact_bound ingestion error: ' + errorMsg + '\n');
                    if (ingestError?.stack) {
                        process.stderr.write('[SignalForge] stack: ' + ingestError.stack + '\n');
                    }
                    return reject(messageId, `artifact_bound ingestion error: ${errorMsg}`);
                }
            }
            catch (validationError) {
                const errorMsg = String(validationError?.message || validationError || 'unknown validation error');
                console.error('[SignalForge] copy_binding_requested handler crashed', {
                    message_id: messageId,
                    error: errorMsg,
                    stack: String(validationError?.stack || ''),
                });
                process.stderr.write('[SignalForge] copy_binding_requested error: ' + errorMsg + '\n');
                if (validationError?.stack) {
                    process.stderr.write('[SignalForge] stack: ' + validationError.stack + '\n');
                }
                return reject(messageId, `copy_binding_requested handler error: ${errorMsg}`);
            }
        }
        if (payload.type === 'copilot_candidate_lookup_query') {
            const lookupDb = await ensureNativeHostDb();
            const projectId = String(payload.project_id || '').trim();
            const sessionId = String(payload.session_id || '').trim();
            const targetHash = String(payload.text_hash || '').trim();
            const targetLength = Number(payload.normalized_length || 0);
            const excerpt = String(payload.excerpt || '').trim();
            const capturedAt = asIso(payload.captured_at);
            const recent = await (0, copilotCandidateRepository_1.getRecentCopilotCandidates)(lookupDb, projectId, sessionId || undefined, 60);
            const capturedAtMs = new Date(capturedAt).getTime();
            let matched = null;
            for (const candidate of recent) {
                const candidateNormalized = normalizeText(candidate.raw_text);
                const candidateHash = computeTextHash(candidateNormalized);
                if (candidateHash === targetHash) {
                    matched = { candidate, reason: 'hash_match' };
                    break;
                }
                const candidateCapturedMs = new Date(candidate.captured_at).getTime();
                const withinWindow = Number.isFinite(candidateCapturedMs)
                    && Number.isFinite(capturedAtMs)
                    && Math.abs(candidateCapturedMs - capturedAtMs) <= 10 * 60 * 1000;
                const lengthClose = Math.abs(candidateNormalized.length - targetLength) <= 24;
                const overlap = tokenOverlapRatio(excerpt, candidateNormalized);
                if (withinWindow && lengthClose && overlap >= 0.72) {
                    matched = { candidate, reason: 'overlap_fallback' };
                    break;
                }
            }
            return {
                type: 'copilot_candidate_lookup',
                message_id: messageId,
                found: !!matched,
                candidate_id: matched?.candidate?.candidate_id || null,
                project_id: matched?.candidate?.project_id,
                session_id: matched?.candidate?.session_id,
                captured_at: matched?.candidate?.captured_at,
                summary_reason: matched ? `native_host_${matched.reason}` : 'native_host_no_match',
            };
        }
        if (payload.type === 'chatgpt_turn_classified') {
            const db = await ensureNativeHostDb();
            const projectId = String(payload.project_id || '').trim();
            const sessionId = String(payload.session_id || '').trim();
            const summaryReason = String(payload.summary_reason || payload.classification || '').trim();
            if (!projectId) {
                return warnAndAck(messageId, 'classification metadata missing project_id; acknowledged without persistence');
            }
            const normalizedSessionId = sessionId || `session_${projectId}`;
            const content = JSON.stringify({
                summary: summaryReason || 'ChatGPT turn classified',
                classification: payload.classification || null,
                classification_signals: Array.isArray(payload.classification_signals) ? payload.classification_signals : [],
                timestamp: payload.timestamp || new Date().toISOString(),
                turn_id: payload.eventId || messageId,
                source_url: payload.sourceUrl || null,
                correlated_candidate_id: payload.correlated_candidate_id || null,
                raw_text: payload.content || null,
            });
            try {
                await (0, ingestChatEvent_1.ingestChatEvent)(db, {
                    chat_thread_id: normalizedSessionId,
                    turn_index: payload.turnIndex ?? 0,
                    role: payload.role || 'observer',
                    event_type: 'chatgpt_turn_classified',
                    source: 'browser',
                    project_id: projectId,
                    session_id: normalizedSessionId,
                    dispatch_id: payload.dispatch_id || null,
                    content,
                    source_url: payload.sourceUrl || null,
                    created_at: payload.timestamp || new Date().toISOString(),
                });
            }
            catch (error) {
                console.warn('[SignalForge] failed to persist chatgpt_turn_classified; acknowledging anyway', { message_id: messageId, error: String(error) });
            }
            return accept(messageId);
        }
        const db = await ensureNativeHostDb();
        if (payload.type === 'copilot_candidate_captured') {
            const inbound = payload;
            const resolved = await resolveSessionAndDispatchContext(db, inbound);
            const contentHash = resolveCandidateContentHash(inbound);
            const normalizedSource = resolveCandidateSource(inbound?.source);
            const normalizedCandidate = {
                ...inbound,
                session_id: resolved.sessionId,
                dispatch_id: resolved.dispatchId,
                contract_ref: typeof inbound?.contract_ref === 'string' && inbound.contract_ref.trim() ? String(inbound.contract_ref).trim() : null,
                source: normalizedSource,
                content_hash: contentHash,
            };
            await (0, copilotCandidateRepository_1.insertCopilotCandidateStaging)(db, {
                candidate_id: normalizedCandidate.candidate_id,
                project_id: normalizedCandidate.project_id,
                session_id: normalizedCandidate.session_id,
                dispatch_id: normalizedCandidate.dispatch_id || null,
                contract_ref: normalizedCandidate.contract_ref || null,
                captured_at: normalizedCandidate.captured_at,
                source: normalizedCandidate.source,
                raw_text: normalizedCandidate.raw_text,
                content_hash: normalizedCandidate.content_hash || null,
                signal_flags_json: JSON.stringify(normalizedCandidate.signal_flags || {}),
                capture_context_json: normalizedCandidate.capture_context ? JSON.stringify(normalizedCandidate.capture_context) : null,
                diagnostic_score: null,
                gate_pass: null,
                gate_failure_reason: null,
                failed_invariants_json: null,
                validation_status: 'pending',
                rejection_reason: null,
            });
            try {
                await emitValidationLifecycleEvent(db, 'copilot_candidate_captured', {
                    project_id: normalizedCandidate.project_id,
                    session_id: normalizedCandidate.session_id,
                    dispatch_id: normalizedCandidate.dispatch_id,
                    candidate_id: normalizedCandidate.candidate_id,
                    timestamp: normalizedCandidate.captured_at,
                    summary_reason: 'Clipboard candidate staged for deterministic validation.',
                });
            }
            catch (eventErr) {
                console.warn('[SignalForge] failed to persist copilot_candidate_captured lifecycle event; continuing gate', {
                    candidate_id: normalizedCandidate.candidate_id,
                    message_id: messageId,
                    error: String(eventErr),
                });
            }
            try {
                const resolvedWorkspaceRoot = await resolveWorkspaceRootForProject(db, normalizedCandidate.project_id);
                if (resolvedWorkspaceRoot) {
                    rememberWorkspaceRoot(normalizedCandidate.project_id, resolvedWorkspaceRoot);
                }
                console.log('[SignalForge] validator workspace context resolved', {
                    candidate_id: normalizedCandidate.candidate_id,
                    project_id: normalizedCandidate.project_id,
                    workspace_root: resolvedWorkspaceRoot || null,
                });
                const validation = (0, copilotValidationService_1.validateCopilotCandidate)(normalizedCandidate, {
                    workspaceRoot: resolvedWorkspaceRoot,
                });
                const contractGate = (0, copilotValidationService_1.passesContractGate)(normalizedCandidate, {
                    workspaceRoot: resolvedWorkspaceRoot,
                });
                await (0, copilotCandidateRepository_1.updateCopilotCandidateEvaluation)(db, normalizedCandidate.candidate_id, {
                    diagnosticScore: validation.evidence.signal_total_score,
                    gatePass: contractGate.gatePass,
                    gateFailureReason: contractGate.gateFailureReason,
                    failedInvariantsJson: JSON.stringify(contractGate.failedInvariants),
                });
                if (!contractGate.gatePass) {
                    const gateFailureReason = contractGate.gateFailureReason || 'contract gate failed';
                    await (0, copilotCandidateRepository_1.updateCopilotCandidateStatus)(db, normalizedCandidate.candidate_id, 'rejected', gateFailureReason);
                    await emitValidationLifecycleEvent(db, 'copilot_candidate_rejected', {
                        project_id: normalizedCandidate.project_id,
                        session_id: normalizedCandidate.session_id,
                        dispatch_id: normalizedCandidate.dispatch_id,
                        candidate_id: normalizedCandidate.candidate_id,
                        timestamp: new Date().toISOString(),
                        summary_reason: gateFailureReason,
                        reasons: contractGate.failedInvariants,
                    });
                    await emitOutcomeForValidationResult(db, 'copilot_candidate_rejected', {
                        project_id: normalizedCandidate.project_id,
                        session_id: normalizedCandidate.session_id,
                        dispatch_id: normalizedCandidate.dispatch_id,
                        candidate_id: normalizedCandidate.candidate_id,
                        contract_ref: normalizedCandidate.contract_ref || null,
                        timestamp: new Date().toISOString(),
                        summary_reason: gateFailureReason,
                        reasons: contractGate.failedInvariants,
                    });
                    return accept(messageId);
                }
                const artifactId = `art_${normalizedCandidate.candidate_id}`;
                const validationEvidence = {
                    checks_performed: {
                        file_reference_extraction: contractGate.resolvedWorkspaceFiles.length > 0,
                        workspace_existence: contractGate.resolvedWorkspaceFiles.length > 0,
                        git_correlation: validation.matchedDiffFiles.length > 0,
                        semantic_alignment: validation.evidence.semantic_alignment_ok,
                        structural_integrity: validation.evidence.structural_integrity_ok,
                        session_project_binding: true,
                    },
                    result: validation,
                    contract_gate: contractGate,
                    diagnostic_score: validation.evidence.signal_total_score,
                };
                await (0, copilotArtifactRepository_1.insertCopilotExecutionArtifact)(db, {
                    artifact_id: artifactId,
                    candidate_id: normalizedCandidate.candidate_id,
                    project_id: normalizedCandidate.project_id,
                    session_id: normalizedCandidate.session_id,
                    dispatch_id: normalizedCandidate.dispatch_id || null,
                    validated_at: new Date().toISOString(),
                    raw_text: normalizedCandidate.raw_text,
                    extracted_file_refs_json: validation.extractedFileRefs.length
                        ? JSON.stringify(validation.extractedFileRefs)
                        : null,
                    git_correlation_json: JSON.stringify({
                        matchedDiffFiles: validation.matchedDiffFiles,
                        overlapCount: validation.matchedDiffFiles.length,
                        extractedCount: validation.extractedFileRefs.length,
                    }),
                    validation_evidence_json: JSON.stringify(validationEvidence),
                    source: 'clipboard_validated',
                    artifact_type: 'copilot_execution_narrative',
                });
                await (0, copilotCandidateRepository_1.updateCopilotCandidateStatus)(db, normalizedCandidate.candidate_id, 'promoted', null);
                await emitValidationLifecycleEvent(db, 'copilot_implementation_validated', {
                    project_id: normalizedCandidate.project_id,
                    session_id: normalizedCandidate.session_id,
                    dispatch_id: normalizedCandidate.dispatch_id,
                    candidate_id: normalizedCandidate.candidate_id,
                    artifact_id: artifactId,
                    timestamp: new Date().toISOString(),
                    summary_reason: 'Candidate promoted to canonical copilot execution artifact.',
                });
                await emitOutcomeForValidationResult(db, 'copilot_implementation_validated', {
                    project_id: normalizedCandidate.project_id,
                    session_id: normalizedCandidate.session_id,
                    dispatch_id: normalizedCandidate.dispatch_id,
                    candidate_id: normalizedCandidate.candidate_id,
                    contract_ref: normalizedCandidate.contract_ref || null,
                    artifact_id: artifactId,
                    timestamp: new Date().toISOString(),
                    summary_reason: 'Candidate promoted to canonical copilot execution artifact.',
                });
                return accept(messageId);
            }
            catch (gateErr) {
                const gateErrorReason = `validation gate execution error: ${String(gateErr?.message || gateErr)}`;
                try {
                    await (0, copilotCandidateRepository_1.updateCopilotCandidateStatus)(db, normalizedCandidate.candidate_id, 'rejected', gateErrorReason);
                }
                catch (statusErr) {
                    console.error('[SignalForge] failed to update candidate status after validation gate error', {
                        candidate_id: normalizedCandidate.candidate_id,
                        message_id: messageId,
                        status_error: String(statusErr),
                    });
                }
                try {
                    await emitValidationLifecycleEvent(db, 'copilot_candidate_rejected', {
                        project_id: normalizedCandidate.project_id,
                        session_id: normalizedCandidate.session_id,
                        dispatch_id: normalizedCandidate.dispatch_id,
                        candidate_id: normalizedCandidate.candidate_id,
                        timestamp: new Date().toISOString(),
                        summary_reason: gateErrorReason,
                        reasons: [gateErrorReason],
                    });
                    await emitOutcomeForValidationResult(db, 'copilot_candidate_rejected', {
                        project_id: normalizedCandidate.project_id,
                        session_id: normalizedCandidate.session_id,
                        dispatch_id: normalizedCandidate.dispatch_id,
                        candidate_id: normalizedCandidate.candidate_id,
                        contract_ref: normalizedCandidate.contract_ref || null,
                        timestamp: new Date().toISOString(),
                        summary_reason: gateErrorReason,
                        reasons: [gateErrorReason],
                    });
                }
                catch (emitErr) {
                    console.warn('[SignalForge] failed to emit validation gate error lifecycle event', {
                        candidate_id: normalizedCandidate.candidate_id,
                        message_id: messageId,
                        error: String(emitErr),
                    });
                }
                return accept(messageId);
            }
        }
        if (payload.type === 'artifact_bound') {
            await (0, ingestArtifactBound_1.ingestArtifactBound)(db, payload);
            return accept(messageId);
        }
        if (payload.type === 'chatgpt_turn_classified') {
            await (0, ingestChatEvent_1.ingestChatEvent)(db, {
                chat_thread_id: payload.chatThreadId,
                turn_index: payload.turnIndex ?? 0,
                role: payload.role || null,
                event_type: 'chatgpt_turn_classified',
                source: 'browser',
                project_id: payload.project_id,
                session_id: payload.session_id,
                dispatch_id: payload.dispatch_id || null,
                content: JSON.stringify({
                    summary: payload.summary_reason,
                    classification: payload.classification,
                    classification_signals: payload.classification_signals || [],
                    timestamp: payload.timestamp,
                    turn_id: payload.eventId,
                    source_url: payload.sourceUrl || null,
                    correlated_candidate_id: payload.correlated_candidate_id || null,
                    raw_text: payload.content,
                }),
                source_url: payload.sourceUrl || null,
                created_at: payload.timestamp,
            });
            if (payload.classification === 'chatgpt_verification_response' && payload.role === 'assistant') {
                const verificationId = `vrf_${payload.eventId}`;
                await (0, verificationRepository_1.insertChatGPTVerificationEvent)(db, {
                    verification_id: verificationId,
                    project_id: payload.project_id,
                    session_id: payload.session_id,
                    dispatch_id: payload.dispatch_id || null,
                    thread_id: payload.chatThreadId,
                    turn_id: payload.eventId,
                    captured_at: payload.timestamp,
                    raw_text: String(payload.content || ''),
                    classification_signals_json: JSON.stringify(payload.classification_signals || []),
                    source: 'chatgpt',
                });
                await emitValidationLifecycleEvent(db, 'chatgpt_verification_captured', {
                    project_id: payload.project_id,
                    session_id: payload.session_id,
                    dispatch_id: payload.dispatch_id || null,
                    candidate_id: verificationId,
                    timestamp: payload.timestamp,
                    summary_reason: 'Captured assistant verification response as canonical evidence.',
                    reasons: payload.classification_signals || [],
                });
            }
            return accept(messageId);
        }
        if (typeof payload.type === 'string') {
            return warnAndAck(messageId, `unsupported payload type: ${payload.type}`);
        }
        return warnAndAck(messageId, 'unsupported payload type: unknown');
    }
    catch (err) {
        const messageId = (raw && (raw.message_id || raw?.payload?.eventId || raw?.payload?.chat_id)) || 'msg_unknown';
        return reject(messageId, String(err));
    }
}
exports.handleInbound = handleInbound;

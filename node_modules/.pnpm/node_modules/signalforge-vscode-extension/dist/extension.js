"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const sessionBootstrapService_1 = require("./services/sessionBootstrapService");
const sessionStatusReporter_1 = require("./services/sessionStatusReporter");
// Node APIs used for deterministic artifact generation
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
let extensionSharedDb = null;
function closeDbConnection(db, label) {
    return new Promise((resolve) => {
        if (!db || typeof db.close !== 'function') {
            resolve();
            return;
        }
        let settled = false;
        const done = () => {
            if (settled)
                return;
            settled = true;
            resolve();
        };
        try {
            const maybePromise = db.close((err) => {
                if (err) {
                    console.warn(`[SignalForge:db] ${label} close callback error`, err);
                }
                done();
            });
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise
                    .then(() => done())
                    .catch((err) => {
                    console.warn(`[SignalForge:db] ${label} close promise error`, err);
                    done();
                });
                return;
            }
            // sqlite3 close uses callback; in adapters with sync close there may be no callback.
            if (db.close.length === 0) {
                done();
            }
        }
        catch (err) {
            console.warn(`[SignalForge:db] ${label} close threw`, err);
            done();
        }
    });
}
class SignalForgeTreeProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(element) { return element; }
    getChildren() {
        const items = [];
        const wf = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        const workspaceLabel = wf ? `${wf.name} — ${wf.uri.fsPath}` : 'No workspace open';
        const workspaceItem = new vscode.TreeItem(workspaceLabel, vscode.TreeItemCollapsibleState.None);
        items.push(workspaceItem);
        const pinned = this.context.globalState.get('signalforge.pinnedProject');
        const pinnedLabel = pinned ? `Pinned: ${pinned.projectId} (${pinned.workspaceRoot})` : 'Pinned: (none)';
        const pinnedItem = new vscode.TreeItem(pinnedLabel, vscode.TreeItemCollapsibleState.None);
        items.push(pinnedItem);
        const latest = this.context.globalState.get('signalforge.latestDispatch');
        const dispatchLabel = latest && latest.threadId
            ? `Latest dispatch: ${latest.threadId}${latest.dispatchId ? ` (${latest.dispatchId})` : ''}`
            : 'Latest dispatch: (none)';
        const dispatchItem = new vscode.TreeItem(dispatchLabel, vscode.TreeItemCollapsibleState.None);
        items.push(dispatchItem);
        const materialized = latest && latest.lastMaterializationResult ? `Last materialization: ${latest.lastMaterializationResult}` : 'Last materialization: (none)';
        const matItem = new vscode.TreeItem(materialized, vscode.TreeItemCollapsibleState.None);
        items.push(matItem);
        // active session
        const activeSession = this.context.globalState.get('signalforge.activeSession');
        const sessionLabel = activeSession ? `Active session: ${activeSession}` : 'Active session: (none)';
        const sessionItem = new vscode.TreeItem(sessionLabel, vscode.TreeItemCollapsibleState.None);
        items.push(sessionItem);
        return Promise.resolve(items);
    }
}
function activate(context) {
    const treeProvider = new SignalForgeTreeProvider(context);
    vscode.window.registerTreeDataProvider('signalforgeView', treeProvider);
    // Use one shared DB handle so bootstrap writes and refresh reads are guaranteed to hit the same instance.
    const coreDbModuleId = require.resolve('@signalforge/core/dist/storage/db');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { openDatabase: openCoreDatabase, getDefaultDbPath } = require('@signalforge/core/dist/storage/db');
    const sharedDb = openCoreDatabase();
    extensionSharedDb = sharedDb;
    const sharedDbAdapter = sharedDb && sharedDb.constructor && sharedDb.constructor.name
        ? sharedDb.constructor.name
        : typeof sharedDb;
    const bootstrapEnv = process.env.SIGNALFORGE_USE_INMEMORY_DB ?? '(unset)';
    console.log(`[SignalForge:db] activate env=${bootstrapEnv} module=${coreDbModuleId} adapter=${sharedDbAdapter}`);
    try {
        const dbPath = getDefaultDbPath();
        console.log('[SignalForge:path] startup', {
            process: 'vscode-extension',
            db_path: dbPath,
            signal_file: path.join(path.dirname(dbPath), 'bootstrap-authority-event.json'),
        });
    }
    catch (error) {
        console.log('[SignalForge:path] startup failed', {
            process: 'vscode-extension',
            error: String(error),
        });
    }
    async function rehydrateActiveSessionFromDatabase() {
        const pinned = context.globalState.get('signalforge.pinnedProject');
        const folders = vscode.workspace.workspaceFolders || [];
        const targetRoot = pinned?.workspaceRoot || (folders[0] && folders[0].uri.fsPath);
        if (!targetRoot)
            return;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { deriveProjectIdFromPath } = require('@signalforge/core/dist/projects/projectService');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getActiveSessionByProject } = require('@signalforge/core/dist/repositories/sessionRepository');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { initSchema } = require('@signalforge/core/dist/storage/db');
        const projectId = pinned?.projectId || deriveProjectIdFromPath(targetRoot);
        await initSchema(sharedDb);
        const activeSession = await getActiveSessionByProject(sharedDb, projectId);
        if (activeSession?.session_id) {
            await context.globalState.update('signalforge.activeSession', activeSession.session_id);
            console.log(`[SignalForge:db] rehydrated active session ${activeSession.session_id} for project ${projectId}`);
        }
    }
    rehydrateActiveSessionFromDatabase().catch((error) => {
        console.log('[SignalForge:db] failed to rehydrate active session', error?.message || String(error));
    });
    const sessionStatusReporter = new sessionStatusReporter_1.SessionStatusReporter(context);
    context.subscriptions.push(sessionStatusReporter);
    const sessionBootstrapService = new sessionBootstrapService_1.SessionBootstrapService(context, () => sharedDb);
    const config = vscode.workspace.getConfiguration('signalforge');
    const debugMode = !!config.get('debugMode', false);
    function debugLog(message, payload) {
        if (!debugMode)
            return;
        console.log(`[SignalForge:debug] ${message}`, payload ?? '');
    }
    // Helper utilities
    function openCoreDb() {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const openDatabase = require('@signalforge/core/dist/storage/db').openDatabase;
        return openDatabase();
    }
    function resolveTargetWorkspace() {
        const pinned = context.globalState.get('signalforge.pinnedProject');
        const folders = vscode.workspace.workspaceFolders || [];
        if (!pinned && folders.length > 1) {
            throw new Error('Multiple workspace folders present. Pin a project before materializing.');
        }
        const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
        if (!targetRoot)
            throw new Error('No target workspace available.');
        return { targetRoot, pinned };
    }
    function resolveLatestDispatch() {
        const latest = context.globalState.get('signalforge.latestDispatch');
        if (!latest || !latest.threadId)
            throw new Error('No latest dispatch recorded.');
        return latest;
    }
    async function recordLatestArtifactPath(key, filePath) {
        try {
            const artifacts = context.globalState.get('signalforge.latestArtifacts') || {};
            artifacts[key] = filePath;
            await context.globalState.update('signalforge.latestArtifacts', artifacts);
        }
        catch { }
    }
    function toCanonicalArtifactEvent(row, fallbackProjectId) {
        let content = row && row.content;
        if (typeof content === 'string') {
            const trimmed = content.trim();
            if (!trimmed) {
                content = {};
            }
            else {
                try {
                    content = JSON.parse(trimmed);
                }
                catch {
                    content = { summary: trimmed };
                }
            }
        }
        if (content === null || content === undefined)
            content = {};
        if (typeof content !== 'object')
            content = { summary: String(content) };
        return {
            event_id: row?.event_id,
            thread_id: row?.chat_thread_id || row?.thread_id || 'unknown-thread',
            project_id: row?.project_id || fallbackProjectId,
            session_id: row?.session_id || undefined,
            dispatch_id: row?.dispatch_id || undefined,
            source: row?.source || 'vscode',
            role: row?.role,
            event_type: row?.event_type,
            content,
            timestamp: row?.created_at || row?.timestamp || new Date().toISOString(),
        };
    }
    function resolveWorkspaceContext() {
        const pinned = context.globalState.get('signalforge.pinnedProject');
        const folders = vscode.workspace.workspaceFolders || [];
        if (!pinned && folders.length > 1) {
            throw new Error('Multiple workspace folders present. Pin a project before capturing workspace errors.');
        }
        const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
        if (!targetRoot) {
            throw new Error('No target workspace available.');
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { deriveProjectIdFromPath } = require('@signalforge/core/dist/projects/projectService');
        const projectId = pinned ? pinned.projectId : deriveProjectIdFromPath(targetRoot);
        const sessionId = context.globalState.get('signalforge.activeSession') || `session_${Date.now()}`;
        return {
            targetRoot,
            projectId,
            sessionId,
            activeProject: folders[0]?.name || 'SignalForge',
            activeContract: 'Phase 3 Build Contract',
            pinnedProject: pinned ? pinned.projectId : projectId,
        };
    }
    function severityLabel(severity) {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error: return 'error';
            case vscode.DiagnosticSeverity.Warning: return 'warning';
            case vscode.DiagnosticSeverity.Information: return 'information';
            default: return 'hint';
        }
    }
    function categorizeDiagnostic(diagnostic) {
        const code = String(diagnostic.code ?? '').toLowerCase();
        const message = diagnostic.message.toLowerCase();
        const text = `${code} ${message}`;
        if (text.includes('cannot find module') || text.includes('module not found') || text.includes('module resolution'))
            return 'import_resolution';
        if (text.includes('cannot find name') || text.includes('is not defined') || text.includes('missing symbol'))
            return 'missing_symbols';
        if (text.includes('is not assignable') || text.includes('type') || code.startsWith('ts'))
            return 'type_mismatch';
        if (text.includes('config') || text.includes('schema') || text.includes('tsconfig') || text.includes('json'))
            return 'configuration_schema';
        return 'other';
    }
    function collectWorkspaceDiagnostics(targetRoot) {
        const diagnostics = vscode.languages.getDiagnostics();
        const normalizedRoot = path.resolve(targetRoot).toLowerCase();
        const collected = [];
        for (const [uri, entries] of diagnostics) {
            const filePath = uri.fsPath;
            const normalizedPath = path.resolve(filePath).toLowerCase();
            if (!normalizedPath.startsWith(normalizedRoot))
                continue;
            for (const diagnostic of entries) {
                collected.push({
                    file: path.relative(targetRoot, filePath).replace(/\\/g, '/'),
                    severity: severityLabel(diagnostic.severity),
                    code: String(diagnostic.code ?? ''),
                    message: diagnostic.message,
                    line: diagnostic.range.start.line + 1,
                    column: diagnostic.range.start.character + 1,
                    source: diagnostic.source || 'vscode',
                    category: categorizeDiagnostic(diagnostic),
                });
            }
        }
        return collected;
    }
    function groupDiagnostics(diagnostics) {
        const groups = {
            import_resolution: [],
            type_mismatch: [],
            missing_symbols: [],
            configuration_schema: [],
            other: [],
        };
        for (const diagnostic of diagnostics) {
            groups[diagnostic.category] = groups[diagnostic.category] || [];
            groups[diagnostic.category].push(diagnostic);
        }
        return groups;
    }
    function buildWorkspaceErrorsMarkdown(payload) {
        const grouped = groupDiagnostics(payload.diagnostics);
        const lines = [];
        lines.push('# SignalForge Workspace Errors Capture');
        lines.push('');
        lines.push('## Payload');
        lines.push('```json');
        lines.push(JSON.stringify(payload, null, 2));
        lines.push('```');
        lines.push('');
        lines.push('## ChatGPT Prompt');
        lines.push('Given our architectural spec, identify root causes and propose the minimum fixes that resolve the maximum errors.');
        lines.push('');
        lines.push(`Project: ${payload.project_id}`);
        lines.push(`Session: ${payload.session_id}`);
        lines.push('');
        lines.push('Architectural Context:');
        lines.push(`- Active project: ${payload.architectural_context.active_project}`);
        lines.push(`- Active contract: ${payload.architectural_context.active_contract}`);
        lines.push(`- Pinned project: ${payload.architectural_context.pinned_project}`);
        lines.push('');
        lines.push('Workspace Diagnostics:');
        const sections = [
            ['import_resolution', 'Import Resolution'],
            ['type_mismatch', 'Type Mismatches'],
            ['missing_symbols', 'Missing Symbols'],
            ['configuration_schema', 'Configuration / Schema Issues'],
            ['other', 'Other'],
        ];
        for (const [key, label] of sections) {
            const entries = grouped[key] || [];
            lines.push(`### ${label} (${entries.length})`);
            if (entries.length === 0) {
                lines.push('- none');
                lines.push('');
                continue;
            }
            for (const diagnostic of entries) {
                lines.push(`- ${diagnostic.file}:${diagnostic.line}:${diagnostic.column} [${diagnostic.severity}] ${diagnostic.code} ${diagnostic.message}`);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    const hello = vscode.commands.registerCommand('signalforge.hello', () => {
        vscode.window.showInformationMessage('SignalForge VS Code extension active.');
    });
    context.subscriptions.push(hello);
    const startCaptureSessionCmd = vscode.commands.registerCommand('signalforge.startCaptureSession', async () => {
        try {
            const result = await sessionBootstrapService.bootstrapCaptureSession(async (progress) => {
                await sessionStatusReporter.update(progress);
            });
            await sessionStatusReporter.update(result);
            treeProvider.refresh();
            if (result.ok) {
                vscode.window.showInformationMessage(`SignalForge session ready for ${result.projectLabel || result.projectId || 'current workspace'}.`);
            }
            else {
                vscode.window.showErrorMessage(`SignalForge session blocked: ${result.reason || 'unknown reason'}`);
            }
        }
        catch (err) {
            const message = String(err);
            await sessionStatusReporter.update({ ok: false, state: 'blocked', reason: message });
            treeProvider.refresh();
            vscode.window.showErrorMessage(`SignalForge session blocked: ${message}`);
        }
    });
    context.subscriptions.push(startCaptureSessionCmd);
    const pinProject = vscode.commands.registerCommand('signalforge.pinProject', async () => {
        const folders = vscode.workspace.workspaceFolders || [];
        let pick;
        if (folders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open to pin.');
            return;
        }
        else if (folders.length === 1) {
            pick = folders[0];
        }
        else {
            const items = folders.map(f => ({ label: f.name, description: f.uri.fsPath, folder: f }));
            const sel = await vscode.window.showQuickPick(items, { placeHolder: 'Select workspace folder to pin' });
            pick = sel ? sel.folder : undefined;
            if (!pick)
                return;
        }
        const workspaceRoot = pick.uri.fsPath;
        try {
            // derive project id using core helper
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { deriveProjectId, ensureProjectRecord } = require('@signalforge/core/dist/projects/projectService');
            const { openDatabase } = require('@signalforge/core/dist/storage/db');
            const alias = await vscode.window.showInputBox({ prompt: 'Optional project alias for stable project_id (leave empty to skip)' });
            const projectId = deriveProjectId(workspaceRoot, alias || null);
            const db = openDatabase();
            await ensureProjectRecord(db, projectId, pick.name, workspaceRoot, workspaceRoot);
            await context.globalState.update('signalforge.pinnedProject', { projectId, workspaceRoot });
            vscode.window.showInformationMessage(`Pinned project ${projectId}`);
            treeProvider.refresh();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to pin project: ${String(err)}`);
        }
    });
    context.subscriptions.push(pinProject);
    const unpin = vscode.commands.registerCommand('signalforge.unpinProject', async () => {
        await context.globalState.update('signalforge.pinnedProject', undefined);
        await context.globalState.update('signalforge.activeProject', undefined);
        await context.globalState.update('signalforge.activeSession', undefined);
        await context.globalState.update('signalforge.captureSessionSeed', undefined);
        await context.globalState.update('signalforge.captureSessionStatus', undefined);
        vscode.window.showInformationMessage('Unpinned project.');
        treeProvider.refresh();
    });
    context.subscriptions.push(unpin);
    const resetExtensionState = vscode.commands.registerCommand('signalforge.resetExtensionState', async () => {
        const knownSignalForgeKeys = [
            'signalforge.activeSession',
            'signalforge.activeProject',
            'signalforge.pinnedProject',
            'signalforge.bootstrapAuthority',
            'signalforge.bootstrapAuthorityMarker',
            'signalforge.latestDispatch',
            'signalforge.latestArtifacts',
            'signalforge.captureSessionSeed',
            'signalforge.captureSessionStatus',
            'signalforge.projectPin',
        ];
        const discoverSignalForgeKeys = (memento) => {
            const discovered = new Set();
            const internalMemento = memento;
            const directValues = internalMemento._value && typeof internalMemento._value === 'object'
                ? Object.keys(internalMemento._value)
                : [];
            for (const key of directValues) {
                if (key.startsWith('signalforge.'))
                    discovered.add(key);
            }
            const nestedValues = internalMemento._storage?._value && typeof internalMemento._storage._value === 'object'
                ? Object.keys(internalMemento._storage._value)
                : [];
            for (const key of nestedValues) {
                if (key.startsWith('signalforge.'))
                    discovered.add(key);
            }
            return Array.from(discovered.values());
        };
        const globalKeys = Array.from(new Set([
            ...knownSignalForgeKeys,
            ...discoverSignalForgeKeys(context.globalState),
        ]));
        const workspaceKeys = Array.from(new Set([
            ...knownSignalForgeKeys,
            ...discoverSignalForgeKeys(context.workspaceState),
        ]));
        await Promise.all([
            ...globalKeys.map((key) => context.globalState.update(key, undefined)),
            ...workspaceKeys.map((key) => context.workspaceState.update(key, undefined)),
        ]);
        const summary = `SignalForge state reset: cleared ${globalKeys.length} global and ${workspaceKeys.length} workspace keys.`;
        vscode.window.showInformationMessage(summary);
        console.log('[SignalForge] resetExtensionState', {
            globalKeys,
            workspaceKeys,
        });
        treeProvider.refresh();
    });
    context.subscriptions.push(resetExtensionState);
    const startSessionCmd = vscode.commands.registerCommand('signalforge.startSession', async () => {
        try {
            const pinned = context.globalState.get('signalforge.pinnedProject');
            const folders = vscode.workspace.workspaceFolders || [];
            if (!pinned && folders.length > 1) {
                vscode.window.showErrorMessage('Multiple workspace folders present. Pin a project before starting a session.');
                return;
            }
            const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
            if (!targetRoot) {
                vscode.window.showErrorMessage('No workspace available to start session for.');
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { deriveProjectIdFromPath, ensureProjectRecord } = require('@signalforge/core/dist/projects/projectService');
            const { openDatabase } = require('@signalforge/core/dist/storage/db');
            const { createSessionWithEvent } = require('@signalforge/core/dist/repositories/sessionRepository');
            const db = openDatabase();
            const projectId = pinned ? pinned.projectId : deriveProjectIdFromPath(targetRoot);
            await ensureProjectRecord(db, projectId, projectId, targetRoot, targetRoot);
            const sessionId = `sess_${Date.now()}`;
            const now = new Date().toISOString();
            const row = { session_id: sessionId, project_id: projectId, branch: null, status: 'active', started_at: now, ended_at: null, is_pinned: !!pinned, source: 'vscode' };
            debugLog('event creation', { event_type: 'session_started', sessionId, projectId });
            await createSessionWithEvent(db, row);
            debugLog('validation result', { valid: true, event_type: 'session_started', sessionId });
            await context.globalState.update('signalforge.activeSession', sessionId);
            vscode.window.showInformationMessage(`Started session ${sessionId} for project ${projectId}`);
            treeProvider.refresh();
        }
        catch (err) {
            const msg = String(err);
            vscode.window.showErrorMessage(msg.includes('Event must') || msg.includes('requires project_id') ? `Validation error: ${msg}` : msg);
        }
    });
    context.subscriptions.push(startSessionCmd);
    const endSessionCmd = vscode.commands.registerCommand('signalforge.endSession', async () => {
        try {
            const active = context.globalState.get('signalforge.activeSession');
            if (!active) {
                vscode.window.showInformationMessage('No active session in global state.');
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const openDatabase = require('@signalforge/core/dist/storage/db').openDatabase;
            const { endSessionWithEvent } = require('@signalforge/core/dist/repositories/sessionRepository');
            const db = openDatabase();
            const now = new Date().toISOString();
            debugLog('event creation', { event_type: 'session_ended', sessionId: active });
            await endSessionWithEvent(db, active, now);
            await context.globalState.update('signalforge.activeSession', undefined);
            vscode.window.showInformationMessage(`Ended session ${active}`);
            treeProvider.refresh();
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(endSessionCmd);
    const showActiveSessionCmd = vscode.commands.registerCommand('signalforge.showActiveSession', async () => {
        try {
            const pinned = context.globalState.get('signalforge.pinnedProject');
            const folders = vscode.workspace.workspaceFolders || [];
            const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
            if (!targetRoot) {
                vscode.window.showInformationMessage('No workspace available.');
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { deriveProjectIdFromPath } = require('@signalforge/core/dist/projects/projectService');
            const { openDatabase } = require('@signalforge/core/dist/storage/db');
            const { getActiveSessionByProject, getSessionById } = require('@signalforge/core/dist/repositories/sessionRepository');
            const db = openDatabase();
            const projectId = pinned ? pinned.projectId : deriveProjectIdFromPath(targetRoot);
            const active = context.globalState.get('signalforge.activeSession');
            let session = null;
            if (active) {
                session = await getSessionById(db, active);
            }
            if (!session) {
                session = await getActiveSessionByProject(db, projectId);
            }
            if (!session) {
                vscode.window.showInformationMessage('No active session found.');
                return;
            }
            const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(session, null, 2), language: 'json' });
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(showActiveSessionCmd);
    const captureWorkspaceErrorsCmd = vscode.commands.registerCommand('signalforge.captureWorkspaceErrors', async () => {
        try {
            const contextInfo = resolveWorkspaceContext();
            const diagnostics = collectWorkspaceDiagnostics(contextInfo.targetRoot);
            const summary = {
                total_errors: diagnostics.filter((entry) => entry.severity === 'error').length,
                total_warnings: diagnostics.filter((entry) => entry.severity === 'warning').length,
                files_affected: new Set(diagnostics.map((entry) => entry.file)).size,
            };
            const capturedAt = new Date().toISOString();
            const payload = {
                type: 'workspace_errors_captured',
                project_id: contextInfo.projectId,
                session_id: contextInfo.sessionId,
                captured_at: capturedAt,
                summary,
                diagnostics,
                architectural_context: {
                    active_project: contextInfo.activeProject,
                    active_contract: contextInfo.activeContract,
                    pinned_project: contextInfo.pinnedProject,
                },
            };
            const markdown = buildWorkspaceErrorsMarkdown(payload);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { openDatabase } = require('@signalforge/core/dist/storage/db');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { insertChatEvent } = require('@signalforge/core/dist/repositories/chatEventRepository');
            const db = openDatabase();
            await insertChatEvent(db, {
                chat_thread_id: `workspace_${contextInfo.projectId}`,
                project_id: contextInfo.projectId,
                session_id: contextInfo.sessionId,
                dispatch_id: null,
                source: 'vscode',
                turn_index: 0,
                role: 'observer',
                event_type: 'workspace_errors_captured',
                content: JSON.stringify({
                    summary: `Captured ${summary.total_errors} errors and ${summary.total_warnings} warnings`,
                    details: markdown,
                    metadata: payload,
                }),
                artifact_refs: null,
                source_url: null,
                matched_trigger: null,
                created_at: capturedAt,
            });
            await vscode.env.clipboard.writeText(markdown);
            const doc = await vscode.workspace.openTextDocument({ content: markdown, language: 'markdown' });
            await vscode.window.showTextDocument(doc, { preview: false });
            vscode.window.showInformationMessage('Workspace errors captured and copied to clipboard.');
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(captureWorkspaceErrorsCmd);
    const showLatest = vscode.commands.registerCommand('signalforge.showLatestDispatch', async () => {
        const latest = context.globalState.get('signalforge.latestDispatch');
        if (!latest || !latest.threadId) {
            vscode.window.showInformationMessage('No latest dispatch recorded.');
            return;
        }
        vscode.window.showInformationMessage(`Latest dispatch: ${latest.threadId}`);
    });
    context.subscriptions.push(showLatest);
    const materializeLatest = vscode.commands.registerCommand('signalforge.materializeLatestDispatch', async () => {
        const latest = context.globalState.get('signalforge.latestDispatch');
        if (!latest || !latest.threadId) {
            vscode.window.showErrorMessage('No latest dispatch to materialize.');
            return;
        }
        const pinned = context.globalState.get('signalforge.pinnedProject');
        const folders = vscode.workspace.workspaceFolders || [];
        if (!pinned && folders.length > 1) {
            vscode.window.showErrorMessage('Multiple workspace folders present. Pin a project before materializing.');
            return;
        }
        const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
        if (!targetRoot) {
            vscode.window.showErrorMessage('No target workspace available to materialize into.');
            return;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { compileDispatch } = require('@signalforge/core/dist/dispatch/dispatchCompiler');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const openDatabase = require('@signalforge/core/dist/storage/db').openDatabase;
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { deriveProjectIdFromPath } = require('@signalforge/core/dist/projects/projectService');
            const db = openDatabase();
            const projectId = pinned ? pinned.projectId : deriveProjectIdFromPath(targetRoot);
            const activeSession = context.globalState.get('signalforge.activeSession') || null;
            debugLog('generator invocation', { generator: 'compileDispatch', threadId: latest.threadId, projectId, activeSession });
            const res = await compileDispatch(latest.threadId, db, { targetDir: targetRoot, projectId, sessionId: activeSession });
            // update latest materialization result
            latest.lastMaterializationResult = `written: ${res.contractPath}`;
            await context.globalState.update('signalforge.latestDispatch', latest);
            vscode.window.showInformationMessage(`Materialized into ${targetRoot}: ${res.contractPath}`);
            treeProvider.refresh();
            try {
                await vscode.commands.executeCommand('signalforge.refreshLatestDispatchFromStore');
            }
            catch { }
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(materializeLatest);
    const setLatest = vscode.commands.registerCommand('signalforge.setLatestDispatchForTesting', async () => {
        const threadId = await vscode.window.showInputBox({ prompt: 'Enter test dispatch/thread id' });
        if (!threadId)
            return;
        await context.globalState.update('signalforge.latestDispatch', { threadId });
        vscode.window.showInformationMessage(`Set latest dispatch ${threadId}`);
        treeProvider.refresh();
    });
    context.subscriptions.push(setLatest);
    const clearLatest = vscode.commands.registerCommand('signalforge.clearLatestDispatch', async () => {
        await context.globalState.update('signalforge.latestDispatch', undefined);
        vscode.window.showInformationMessage('Cleared latest dispatch.');
        treeProvider.refresh();
    });
    context.subscriptions.push(clearLatest);
    const seedTest = vscode.commands.registerCommand('signalforge.seedTestDispatch', async () => {
        const threadId = 'test_thread';
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const openDatabase = require('@signalforge/core/dist/storage/db').openDatabase;
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { insertChatEvent } = require('@signalforge/core/dist/repositories/chatEventRepository');
            const db = openDatabase();
            const { deriveProjectIdFromPath } = require('@signalforge/core/dist/projects/projectService');
            const folders = vscode.workspace.workspaceFolders || [];
            const pinned = context.globalState.get('signalforge.pinnedProject');
            const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
            if (!targetRoot)
                throw new Error('No workspace available to seed test dispatch for.');
            const projectId = pinned ? pinned.projectId : deriveProjectIdFromPath(targetRoot);
            const now = new Date().toISOString();
            const events = [
                {
                    event_id: `evt_${threadId}_1`,
                    chat_thread_id: threadId,
                    project_id: projectId,
                    session_id: context.globalState.get('signalforge.activeSession') || null,
                    dispatch_id: `dsp_${threadId}`,
                    source: 'vscode',
                    turn_index: 1,
                    role: 'user',
                    event_type: 'chat_turn_completed',
                    content: 'This is a seeded test user message.',
                    artifact_refs: null,
                    source_url: null,
                    matched_trigger: null,
                    created_at: now,
                },
                {
                    event_id: `evt_${threadId}_2`,
                    chat_thread_id: threadId,
                    project_id: projectId,
                    session_id: context.globalState.get('signalforge.activeSession') || null,
                    dispatch_id: `dsp_${threadId}`,
                    source: 'vscode',
                    turn_index: 2,
                    role: 'worker',
                    event_type: 'dispatch_candidate_created',
                    content: 'Seeded dispatch candidate content for testing materialization.',
                    artifact_refs: null,
                    source_url: null,
                    matched_trigger: null,
                    created_at: now,
                },
            ];
            for (const e of events) {
                // insertChatEvent returns a promise
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                // @ts-ignore
                await insertChatEvent(db, e);
            }
            await context.globalState.update('signalforge.latestDispatch', { threadId });
            vscode.window.showInformationMessage(`Seeded test dispatch ${threadId}`);
            treeProvider.refresh();
            try {
                await vscode.commands.executeCommand('signalforge.refreshLatestDispatchFromStore');
            }
            catch { }
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to seed test dispatch: ${String(err)}`);
        }
    });
    context.subscriptions.push(seedTest);
    const seedAndMaterialize = vscode.commands.registerCommand('signalforge.seedAndMaterializeTestDispatch', async () => {
        try {
            // seed first
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            await vscode.commands.executeCommand('signalforge.seedTestDispatch');
            const pinned = context.globalState.get('signalforge.pinnedProject');
            const folders = vscode.workspace.workspaceFolders || [];
            if (!pinned && folders.length > 1) {
                vscode.window.showErrorMessage('Multiple workspace folders present. Pin a project before materializing.');
                return;
            }
            const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
            if (!targetRoot) {
                vscode.window.showErrorMessage('No target workspace available to materialize into.');
                return;
            }
            const latest = context.globalState.get('signalforge.latestDispatch');
            if (!latest || !latest.threadId) {
                vscode.window.showErrorMessage('No latest dispatch recorded after seeding.');
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { compileDispatch } = require('@signalforge/core/dist/dispatch/dispatchCompiler');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const openDatabase = require('@signalforge/core/dist/storage/db').openDatabase;
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { deriveProjectIdFromPath } = require('@signalforge/core/dist/projects/projectService');
            const db = openDatabase();
            const projectId = pinned ? pinned.projectId : deriveProjectIdFromPath(targetRoot);
            const activeSession = context.globalState.get('signalforge.activeSession') || null;
            const res = await compileDispatch(latest.threadId, db, { targetDir: targetRoot, projectId, sessionId: activeSession });
            latest.lastMaterializationResult = `written: ${res.contractPath}`;
            await context.globalState.update('signalforge.latestDispatch', latest);
            vscode.window.showInformationMessage(`Seeded and materialized ${latest.threadId} into ${targetRoot}`);
            treeProvider.refresh();
            try {
                await vscode.commands.executeCommand('signalforge.refreshLatestDispatchFromStore');
            }
            catch { }
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(seedAndMaterialize);
    const inspectCmd = vscode.commands.registerCommand('signalforge.inspectDispatchEvents', async () => {
        let latest = context.globalState.get('signalforge.latestDispatch');
        let threadId = latest && latest.threadId;
        if (!threadId) {
            const input = await vscode.window.showInputBox({ prompt: 'Enter dispatch/thread id to inspect' });
            if (!input)
                return;
            threadId = input;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { getChatEventsByThread } = require('@signalforge/core/dist/repositories/chatEventRepository');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const openDatabase = require('@signalforge/core/dist/storage/db').openDatabase;
            const db = openDatabase();
            const events = await getChatEventsByThread(db, threadId);
            const content = JSON.stringify(events || [], null, 2);
            const doc = await vscode.workspace.openTextDocument({ content, language: 'json' });
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(inspectCmd);
    // Artifact generation commands (ADR, session summary, LinkedIn topics)
    function ensureDirSync(dirPath) {
        if (!fs.existsSync(dirPath))
            fs.mkdirSync(dirPath, { recursive: true });
    }
    async function writeProjectFile(targetRoot, relDir, filename, content) {
        const base = path.resolve(targetRoot);
        const dir = path.join(base, relDir);
        ensureDirSync(dir);
        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
    }
    const generateAdr = vscode.commands.registerCommand('signalforge.generateAdrDraft', async () => {
        const latest = context.globalState.get('signalforge.latestDispatch');
        if (!latest || !latest.threadId) {
            vscode.window.showErrorMessage('No latest dispatch to generate ADR for.');
            return;
        }
        const pinned = context.globalState.get('signalforge.pinnedProject');
        const folders = vscode.workspace.workspaceFolders || [];
        if (!pinned && folders.length > 1) {
            vscode.window.showErrorMessage('Multiple workspace folders present. Pin a project before generating ADR.');
            return;
        }
        const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
        if (!targetRoot) {
            vscode.window.showErrorMessage('No target workspace available to write ADR into.');
            return;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { getChatEventsByThread } = require('@signalforge/core/dist/repositories/chatEventRepository');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { buildADR } = require('@signalforge/core/dist/artifacts/adrGenerator');
            const { deriveProjectIdFromPath } = require('@signalforge/core/dist/projects/projectService');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const openDatabase = require('@signalforge/core/dist/storage/db').openDatabase;
            const db = openDatabase();
            const rows = await getChatEventsByThread(db, latest.threadId);
            const projectId = pinned ? pinned.projectId : deriveProjectIdFromPath(targetRoot);
            const canonicalEvents = rows.map((row) => toCanonicalArtifactEvent(row, projectId));
            debugLog('generator invocation', { generator: 'buildADR', threadId: latest.threadId, events: canonicalEvents.length, projectId });
            const adr = buildADR(canonicalEvents);
            const filename = `${latest.threadId}-adr.md`;
            const written = await writeProjectFile(targetRoot, path.join('docs', projectId, 'adr'), filename, adr);
            vscode.window.showInformationMessage(`ADR draft written: ${written}`);
            // record latest artifact path
            await recordLatestArtifactPath('adr', written);
            try {
                const doc = await vscode.workspace.openTextDocument(written);
                await vscode.window.showTextDocument(doc, { preview: false });
            }
            catch (e) {
                // ignore open errors
            }
            treeProvider.refresh();
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(generateAdr);
    const generateSession = vscode.commands.registerCommand('signalforge.generateSessionSummary', async () => {
        const latest = context.globalState.get('signalforge.latestDispatch');
        if (!latest || !latest.threadId) {
            vscode.window.showErrorMessage('No latest dispatch to summarize.');
            return;
        }
        const pinned = context.globalState.get('signalforge.pinnedProject');
        const folders = vscode.workspace.workspaceFolders || [];
        if (!pinned && folders.length > 1) {
            vscode.window.showErrorMessage('Multiple workspace folders present. Pin a project before generating session summary.');
            return;
        }
        const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
        if (!targetRoot) {
            vscode.window.showErrorMessage('No target workspace available to write session summary into.');
            return;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { getChatEventsByThread } = require('@signalforge/core/dist/repositories/chatEventRepository');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { buildSessionSummary } = require('@signalforge/core/dist/sessions/sessionSummary');
            const { deriveProjectIdFromPath } = require('@signalforge/core/dist/projects/projectService');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const openDatabase = require('@signalforge/core/dist/storage/db').openDatabase;
            const db = openDatabase();
            const rows = await getChatEventsByThread(db, latest.threadId);
            const projectId = pinned ? pinned.projectId : deriveProjectIdFromPath(targetRoot);
            const canonicalEvents = rows.map((row) => toCanonicalArtifactEvent(row, projectId));
            debugLog('generator invocation', { generator: 'buildSessionSummary', threadId: latest.threadId, events: canonicalEvents.length, projectId });
            const summary = buildSessionSummary(canonicalEvents, { includeEventTrace: true });
            const filename = `${latest.threadId}-session.md`;
            const written = await writeProjectFile(targetRoot, path.join('docs', projectId, 'sessions'), filename, summary);
            vscode.window.showInformationMessage(`Session summary written: ${written}`);
            await recordLatestArtifactPath('session', written);
            treeProvider.refresh();
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(generateSession);
    const generateLinkedIn = vscode.commands.registerCommand('signalforge.generateLinkedInTopics', async () => {
        const latest = context.globalState.get('signalforge.latestDispatch');
        if (!latest || !latest.threadId) {
            vscode.window.showErrorMessage('No latest dispatch to derive topics from.');
            return;
        }
        const pinned = context.globalState.get('signalforge.pinnedProject');
        const folders = vscode.workspace.workspaceFolders || [];
        if (!pinned && folders.length > 1) {
            vscode.window.showErrorMessage('Multiple workspace folders present. Pin a project before generating topics.');
            return;
        }
        const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
        if (!targetRoot) {
            vscode.window.showErrorMessage('No target workspace available to write topics into.');
            return;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { getChatEventsByThread } = require('@signalforge/core/dist/repositories/chatEventRepository');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { openDatabase } = require('@signalforge/core/dist/storage/db');
            const db = openDatabase();
            const events = await getChatEventsByThread(db, latest.threadId);
            // deterministic topic generation: derive short excerpts from events
            const excerpts = events.map((e) => String(e.content).replace(/\s+/g, ' ').slice(0, 140));
            const topics = [];
            topics.push(`Handoff to Copilot: ${excerpts[0] || 'brief dispatch handoff'}`);
            topics.push(`Architectural Decision Highlight: ${excerpts[1] || 'design highlight'}`);
            topics.push(`Implementation Snapshot: ${excerpts[2] || 'what we built'}`);
            if (excerpts[3])
                topics.push(`Testing & Validation: ${excerpts[3]}`);
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { getOutcomesByDispatch } = require('@signalforge/core/dist/repositories/outcomeRepository');
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { openDatabase } = require('@signalforge/core/dist/storage/db');
                const odb = openDatabase();
                const outcomes = await getOutcomesByDispatch(odb, latest.threadId);
                if (outcomes && outcomes.length > 0) {
                    const o = outcomes[outcomes.length - 1];
                    if (o.what_broke)
                        topics.push(`Friction observed: ${String(o.what_broke).slice(0, 140)}`);
                    if (o.next_step)
                        topics.push(`Next steps: ${String(o.next_step).slice(0, 140)}`);
                }
            }
            catch (e) {
                // ignore
            }
            const now = new Date().toISOString();
            const content = ['# LinkedIn Topic Suggestions', '', `- generatedAt: ${now}`, '', ...topics.map(t => `- ${t}`)].join('\n');
            const filename = `${latest.threadId}-topics.md`;
            const written = await writeProjectFile(targetRoot, path.join('docs', 'posts'), filename, content);
            vscode.window.showInformationMessage(`LinkedIn topics written: ${written}`);
            await recordLatestArtifactPath('topics', written);
            treeProvider.refresh();
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(generateLinkedIn);
    const logOutcomeCmd = vscode.commands.registerCommand('signalforge.logOutcome', async () => {
        try {
            const status = await vscode.window.showQuickPick(['success', 'partial', 'fail'], { placeHolder: 'Select outcome status' });
            if (!status)
                return;
            const title = await vscode.window.showInputBox({ prompt: 'Outcome title (short)' }) || '';
            const whatChanged = await vscode.window.showInputBox({ prompt: 'What changed? (brief)' }) || '';
            const whatBroke = await vscode.window.showInputBox({ prompt: 'What broke or resisted?' }) || '';
            const nextStep = await vscode.window.showInputBox({ prompt: 'Next step' }) || '';
            // determine associations
            const pinned = context.globalState.get('signalforge.pinnedProject');
            const folders = vscode.workspace.workspaceFolders || [];
            const targetRoot = pinned ? pinned.workspaceRoot : (folders[0] && folders[0].uri.fsPath);
            if (!targetRoot)
                throw new Error('No workspace available to log outcome for.');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { deriveProjectIdFromPath } = require('@signalforge/core/dist/projects/projectService');
            const projectId = pinned ? pinned.projectId : deriveProjectIdFromPath(targetRoot);
            const latest = context.globalState.get('signalforge.latestDispatch');
            const dispatchThread = latest && latest.threadId ? latest.threadId : null;
            const activeSession = context.globalState.get('signalforge.activeSession') || null;
            // persist in core store
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { openDatabase } = require('@signalforge/core/dist/storage/db');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { insertOutcomeWithEvent } = require('@signalforge/core/dist/repositories/outcomeRepository');
            const db = openDatabase();
            const outcomeId = `out_${Date.now()}`;
            const now = new Date().toISOString();
            const row = {
                outcome_id: outcomeId,
                project_id: projectId,
                session_id: activeSession,
                dispatch_thread_id: dispatchThread,
                source: 'vscode',
                status,
                title,
                what_changed: whatChanged,
                what_broke: whatBroke,
                next_step: nextStep,
                created_at: now,
            };
            await insertOutcomeWithEvent(db, row);
            debugLog('validation result', { valid: true, event_type: 'outcome_logged', projectId, dispatchThread, activeSession });
            // also store latest outcome id for quick reference
            await recordLatestArtifactPath('latestOutcomeId', outcomeId);
            vscode.window.showInformationMessage(`Outcome logged for project ${projectId}${dispatchThread ? ` and linked to dispatch ${dispatchThread}` : ''}.`);
            treeProvider.refresh();
        }
        catch (err) {
            const msg = String(err);
            vscode.window.showErrorMessage(msg.includes('Event must') || msg.includes('requires project_id') ? `Validation error: ${msg}` : msg);
        }
    });
    context.subscriptions.push(logOutcomeCmd);
    const openOutcomeCmd = vscode.commands.registerCommand('signalforge.openLatestOutcomeLog', async () => {
        try {
            const latest = context.globalState.get('signalforge.latestDispatch');
            const threadId = latest && latest.threadId;
            if (!threadId) {
                vscode.window.showInformationMessage('No latest dispatch to inspect outcomes for.');
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { getOutcomesByDispatch } = require('@signalforge/core/dist/repositories/outcomeRepository');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const openDatabase = require('@signalforge/core/dist/storage/db').openDatabase;
            const db = openDatabase();
            const outcomes = await getOutcomesByDispatch(db, threadId);
            const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(outcomes || [], null, 2), language: 'json' });
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(openOutcomeCmd);
    const refreshCmd = vscode.commands.registerCommand('signalforge.refreshLatestDispatchFromStore', async () => {
        try {
            // delegate to core helper to fetch latest dispatch
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { getLatestDispatch } = require('@signalforge/core/dist/repositories/dispatchRepository');
            const refreshEnv = process.env.SIGNALFORGE_USE_INMEMORY_DB ?? '(unset)';
            const refreshAdapter = sharedDb && sharedDb.constructor && sharedDb.constructor.name
                ? sharedDb.constructor.name
                : typeof sharedDb;
            console.log(`[SignalForge:db] refreshLatestDispatchFromStore env=${refreshEnv} module=${coreDbModuleId} adapter=${refreshAdapter}`);
            const db = sharedDb;
            const row = await getLatestDispatch(db);
            if (!row || !row.chat_thread_id) {
                vscode.window.showInformationMessage('No dispatch_candidate_created events found in store.');
                return;
            }
            await context.globalState.update('signalforge.latestDispatch', {
                threadId: row.chat_thread_id,
                dispatchId: row.dispatch_id,
                projectId: row.project_id,
                discoveredAt: row.created_at,
            });
            vscode.window.showInformationMessage(`Refreshed latest dispatch from store: ${row.chat_thread_id}`);
            treeProvider.refresh();
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(refreshCmd);
    // Auto-refresh latest dispatch from store on activation
    try {
        Promise.resolve(vscode.commands.executeCommand('signalforge.refreshLatestDispatchFromStore')).catch(() => { });
    }
    catch { }
    // Open latest artifact commands
    const openLatestAdr = vscode.commands.registerCommand('signalforge.openLatestAdr', async () => {
        const artifacts = context.globalState.get('signalforge.latestArtifacts');
        const p = artifacts && artifacts.adr;
        if (!p) {
            vscode.window.showInformationMessage('No ADR artifact recorded.');
            return;
        }
        try {
            const doc = await vscode.workspace.openTextDocument(p);
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        catch (e) {
            vscode.window.showErrorMessage(String(e));
        }
    });
    context.subscriptions.push(openLatestAdr);
    const openLatestSession = vscode.commands.registerCommand('signalforge.openLatestSessionSummary', async () => {
        const artifacts = context.globalState.get('signalforge.latestArtifacts');
        const p = artifacts && artifacts.session;
        if (!p) {
            vscode.window.showInformationMessage('No session summary recorded.');
            return;
        }
        try {
            const doc = await vscode.workspace.openTextDocument(p);
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        catch (e) {
            vscode.window.showErrorMessage(String(e));
        }
    });
    context.subscriptions.push(openLatestSession);
    const openLatestTopics = vscode.commands.registerCommand('signalforge.openLatestLinkedInTopics', async () => {
        const artifacts = context.globalState.get('signalforge.latestArtifacts');
        const p = artifacts && artifacts.topics;
        if (!p) {
            vscode.window.showInformationMessage('No LinkedIn topics recorded.');
            return;
        }
        try {
            const doc = await vscode.workspace.openTextDocument(p);
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        catch (e) {
            vscode.window.showErrorMessage(String(e));
        }
    });
    context.subscriptions.push(openLatestTopics);
    const openArtifactsFolder = vscode.commands.registerCommand('signalforge.openArtifactsFolder', async () => {
        try {
            let targetRoot;
            try {
                const resolved = resolveTargetWorkspace();
                targetRoot = resolved.targetRoot;
            }
            catch (e) {
                vscode.window.showErrorMessage(String(e));
                return;
            }
            if (!targetRoot) {
                vscode.window.showInformationMessage('No workspace available to open artifacts for.');
                return;
            }
            const docsPath = path.join(targetRoot, 'docs');
            if (!fs.existsSync(docsPath)) {
                vscode.window.showInformationMessage('No docs folder found in project.');
                return;
            }
            const uri = vscode.Uri.file(docsPath);
            try {
                await vscode.commands.executeCommand('revealFileInOS', uri);
            }
            catch (e) {
                try {
                    await vscode.env.openExternal(uri);
                }
                catch {
                    vscode.window.showErrorMessage('Failed to open artifacts folder.');
                }
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(String(err));
        }
    });
    context.subscriptions.push(openArtifactsFolder);
    const openLatestArtifacts = vscode.commands.registerCommand('signalforge.openLatestArtifacts', async () => {
        const artifacts = context.globalState.get('signalforge.latestArtifacts') || {};
        const items = [];
        if (artifacts.adr)
            items.push({ label: 'ADR', description: artifacts.adr, path: artifacts.adr });
        if (artifacts.session)
            items.push({ label: 'Session Summary', description: artifacts.session, path: artifacts.session });
        if (artifacts.topics)
            items.push({ label: 'LinkedIn Topics', description: artifacts.topics, path: artifacts.topics });
        if (items.length === 0) {
            vscode.window.showInformationMessage('No generated artifacts recorded.');
            return;
        }
        const sel = await vscode.window.showQuickPick(items.map(i => ({ label: i.label, description: i.description })), { placeHolder: 'Open latest artifact' });
        if (!sel)
            return;
        const chosen = items.find(i => i.label === sel.label && i.description === sel.description);
        if (!chosen)
            return;
        try {
            const doc = await vscode.workspace.openTextDocument(chosen.path);
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        catch (e) {
            vscode.window.showErrorMessage(String(e));
        }
    });
    context.subscriptions.push(openLatestArtifacts);
}
exports.activate = activate;
async function deactivate() {
    const db = extensionSharedDb;
    extensionSharedDb = null;
    await closeDbConnection(db, 'extensionSharedDb');
}
exports.deactivate = deactivate;

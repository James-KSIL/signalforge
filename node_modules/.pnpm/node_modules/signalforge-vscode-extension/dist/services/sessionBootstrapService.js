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
exports.SessionBootstrapService = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SessionBootstrapService {
    constructor(context, getDb) {
        this.context = context;
        this.getDb = getDb;
    }
    openCoreDatabase(callSite) {
        const moduleId = require.resolve('@signalforge/core/dist/storage/db');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { openDatabase } = require('@signalforge/core/dist/storage/db');
        const envValue = process.env.SIGNALFORGE_USE_INMEMORY_DB ?? '(unset)';
        const db = this.getDb ? this.getDb() : openDatabase();
        const adapter = db && db.constructor && db.constructor.name ? db.constructor.name : typeof db;
        console.log(`[SignalForge:db] ${callSite} env=${envValue} module=${moduleId} adapter=${adapter}`);
        return db;
    }
    async bootstrapCaptureSession(onProgress) {
        const emit = async (result) => {
            if (onProgress) {
                await onProgress(result);
            }
        };
        await emit({ ok: true, state: 'idle' });
        const target = this.resolveWorkspaceTarget();
        if (!target.ok) {
            const blocked = { ok: false, state: 'blocked', reason: target.reason };
            await emit(blocked);
            return blocked;
        }
        const resolvedProject = await this.resolveProjectIdentity(target.workspaceRoot, target.workspaceLabel);
        if (!resolvedProject.ok) {
            const blocked = {
                ok: false,
                state: 'blocked',
                reason: resolvedProject.reason,
            };
            await emit(blocked);
            return blocked;
        }
        const projectResolved = {
            ok: true,
            state: 'project_resolved',
            projectId: resolvedProject.projectId,
            projectLabel: resolvedProject.projectLabel,
        };
        await emit(projectResolved);
        const pinned = await this.persistProjectPin(resolvedProject.projectId, resolvedProject.projectLabel, target.workspaceRoot);
        if (!pinned.ok) {
            const blocked = {
                ok: false,
                state: 'blocked',
                projectId: resolvedProject.projectId,
                projectLabel: resolvedProject.projectLabel,
                reason: pinned.reason,
            };
            await emit(blocked);
            return blocked;
        }
        const pinnedState = {
            ok: true,
            state: 'project_pinned',
            projectId: resolvedProject.projectId,
            projectLabel: resolvedProject.projectLabel,
        };
        await emit(pinnedState);
        const persisted = await this.persistActiveProjectAuthority(resolvedProject.projectId, resolvedProject.projectLabel, target.workspaceRoot);
        if (!persisted.ok) {
            const blocked = {
                ok: false,
                state: 'blocked',
                projectId: resolvedProject.projectId,
                projectLabel: resolvedProject.projectLabel,
                reason: persisted.reason,
            };
            await emit(blocked);
            return blocked;
        }
        const seeded = await this.seedDispatchState(resolvedProject.projectId, resolvedProject.projectLabel, target.workspaceRoot);
        if (!seeded.ok) {
            const blocked = {
                ok: false,
                state: 'blocked',
                projectId: resolvedProject.projectId,
                projectLabel: resolvedProject.projectLabel,
                reason: seeded.reason,
            };
            await emit(blocked);
            return blocked;
        }
        const dispatchSeeded = {
            ok: true,
            state: 'dispatch_seeded',
            projectId: resolvedProject.projectId,
            projectLabel: resolvedProject.projectLabel,
        };
        await emit(dispatchSeeded);
        const ready = {
            ok: true,
            state: 'capture_ready',
            projectId: resolvedProject.projectId,
            projectLabel: resolvedProject.projectLabel,
        };
        await emit(ready);
        // Emit bootstrap authority to native host (push-based propagation)
        // Chrome background will receive via native host bridge and write to localStorage
        // If event is missed, fallback query on Chrome init will recover state
        await this.emitBootstrapAuthority(resolvedProject.projectId, resolvedProject.projectLabel, target.workspaceRoot);
        return ready;
    }
    resolveWorkspaceTarget() {
        const folders = vscode.workspace.workspaceFolders || [];
        if (folders.length === 0) {
            return { ok: false, reason: 'no workspace resolved' };
        }
        const normalizePath = (value) => path.resolve(value || '').toLowerCase();
        const isInfrastructureFolder = (workspaceRoot) => {
            const root = path.resolve(workspaceRoot || '');
            const markers = [
                path.join(root, 'apps', 'vscode-extension'),
                path.join(root, 'apps', 'native-host'),
                path.join(root, 'packages', 'core'),
            ];
            return markers.every((marker) => fs.existsSync(marker));
        };
        const infrastructureFolders = folders.filter((folder) => isInfrastructureFolder(folder.uri.fsPath));
        const targetFolders = folders.filter((folder) => !isInfrastructureFolder(folder.uri.fsPath));
        const pinned = this.context.globalState.get('signalforge.pinnedProject');
        if (pinned?.workspaceRoot) {
            const pinnedRoot = normalizePath(pinned.workspaceRoot);
            const match = folders.find((folder) => normalizePath(folder.uri.fsPath) === pinnedRoot);
            if (match) {
                if (isInfrastructureFolder(match.uri.fsPath) && targetFolders.length > 0) {
                    // Prefer the actual build target when infra + target are both open.
                }
                else {
                    return {
                        ok: true,
                        workspaceRoot: match.uri.fsPath,
                        workspaceLabel: match.name || match.uri.fsPath,
                    };
                }
            }
            else {
                return { ok: false, reason: 'pinned project does not match an open workspace' };
            }
        }
        if (targetFolders.length === 1) {
            const folder = targetFolders[0];
            return {
                ok: true,
                workspaceRoot: folder.uri.fsPath,
                workspaceLabel: folder.name || folder.uri.fsPath,
            };
        }
        if (targetFolders.length === 0) {
            if (infrastructureFolders.length > 0) {
                return { ok: false, reason: 'only SignalForge infrastructure workspace is open; open target project workspace' };
            }
            if (folders.length === 1) {
                const folder = folders[0];
                return {
                    ok: true,
                    workspaceRoot: folder.uri.fsPath,
                    workspaceLabel: folder.name || folder.uri.fsPath,
                };
            }
            return { ok: false, reason: 'no target workspace resolved' };
        }
        const activeEditorFolder = vscode.window.activeTextEditor
            ? vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)
            : undefined;
        if (activeEditorFolder && !isInfrastructureFolder(activeEditorFolder.uri.fsPath)) {
            return {
                ok: true,
                workspaceRoot: activeEditorFolder.uri.fsPath,
                workspaceLabel: activeEditorFolder.name || activeEditorFolder.uri.fsPath,
            };
        }
        return { ok: false, reason: 'multiple target workspace folders open; active editor in target workspace required to resolve project' };
    }
    async resolveProjectIdentity(workspaceRoot, workspaceLabel) {
        const pinned = this.context.globalState.get('signalforge.pinnedProject');
        if (pinned?.workspaceRoot && pinned.workspaceRoot !== workspaceRoot) {
            return { ok: false, reason: 'existing pinned project belongs to a different workspace' };
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { deriveProjectIdFromPath, ensureProjectRecord } = require('@signalforge/core/dist/projects/projectService');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const projectId = pinned?.projectId || deriveProjectIdFromPath(workspaceRoot);
        const projectLabel = workspaceLabel || projectId;
        try {
            const db = this.openCoreDatabase('sessionBootstrapService.resolveProjectIdentity');
            await ensureProjectRecord(db, projectId, projectLabel, workspaceRoot, workspaceRoot);
            return { ok: true, projectId, projectLabel };
        }
        catch (error) {
            return { ok: false, reason: `project record could not be ensured: ${String(error)}` };
        }
    }
    async persistProjectPin(projectId, projectLabel, workspaceRoot) {
        const current = this.context.globalState.get('signalforge.pinnedProject');
        const nextPin = { projectId, workspaceRoot };
        if (current && current.projectId === projectId && current.workspaceRoot === workspaceRoot) {
            return { ok: true };
        }
        if (current && (current.projectId !== projectId || current.workspaceRoot !== workspaceRoot)) {
            return { ok: false, reason: 'existing pinned project conflicts with current workspace' };
        }
        await this.context.globalState.update('signalforge.pinnedProject', nextPin);
        await this.context.globalState.update('signalforge.activeProject', {
            active_project_id: projectId,
            active_project_label: projectLabel,
            active_project_authority: 'pinned_project',
            workspace_root: workspaceRoot,
        });
        return { ok: true };
    }
    async persistActiveProjectAuthority(projectId, projectLabel, workspaceRoot) {
        const current = this.context.globalState.get('signalforge.activeProject');
        if (current?.active_project_id && current.active_project_id !== projectId) {
            const currentWorkspaceRoot = typeof current.workspace_root === 'string' ? current.workspace_root : '';
            const isStaleFromDifferentWorkspace = !!currentWorkspaceRoot && currentWorkspaceRoot !== workspaceRoot;
            if (!isStaleFromDifferentWorkspace) {
                return { ok: false, reason: 'active project already persisted for a different project' };
            }
        }
        if (current?.active_project_id === projectId &&
            current?.workspace_root === workspaceRoot &&
            current?.active_project_authority === 'pinned_project') {
            return { ok: true };
        }
        await this.context.globalState.update('signalforge.activeProject', {
            active_project_id: projectId,
            active_project_label: projectLabel,
            active_project_authority: 'pinned_project',
            workspace_root: workspaceRoot,
            persisted_at: new Date().toISOString(),
        });
        return { ok: true };
    }
    async seedDispatchState(projectId, projectLabel, workspaceRoot) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createSessionWithEvent, getActiveSessionByProject } = require('@signalforge/core/dist/repositories/sessionRepository');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { insertChatEvent, getChatEventsByThread } = require('@signalforge/core/dist/repositories/chatEventRepository');
        const ensureDispatchCandidateEvent = async (sessionId) => {
            const existingEvents = await getChatEventsByThread(db, sessionId);
            const alreadySeeded = Array.isArray(existingEvents)
                && existingEvents.some((event) => event && event.event_type === 'dispatch_candidate_created');
            const seededAt = new Date().toISOString();
            const dispatchId = `dsp_${sessionId}`;
            await insertChatEvent(db, {
                chat_thread_id: sessionId,
                project_id: projectId,
                session_id: sessionId,
                dispatch_id: dispatchId,
                source: 'vscode',
                turn_index: 0,
                role: 'worker',
                event_type: 'dispatch_candidate_created',
                content: {
                    summary: `Capture dispatch seeded for project ${projectLabel}`,
                    details: `Workspace root: ${workspaceRoot}`,
                    metadata: {
                        seed_mode: alreadySeeded
                            ? 'controlled_execution_bootstrap_refresh'
                            : 'controlled_execution_bootstrap',
                        seeded_at: seededAt,
                    },
                },
                created_at: seededAt,
            });
            await this.context.globalState.update('signalforge.latestDispatch', {
                threadId: sessionId,
                dispatchId,
                projectId,
                discoveredAt: seededAt,
            });
        };
        const db = this.openCoreDatabase('sessionBootstrapService.seedDispatchState');
        const existing = await getActiveSessionByProject(db, projectId);
        if (existing?.session_id) {
            try {
                await ensureDispatchCandidateEvent(existing.session_id);
                await this.context.globalState.update('signalforge.activeSession', existing.session_id);
                await this.context.globalState.update('signalforge.captureSessionSeed', {
                    session_id: existing.session_id,
                    project_id: projectId,
                    project_label: projectLabel,
                    workspace_root: workspaceRoot,
                    reused: true,
                });
                return { ok: true, sessionId: existing.session_id };
            }
            catch (error) {
                return { ok: false, reason: `dispatch seed failed for active session: ${String(error)}` };
            }
        }
        const sessionId = `sf_capture_${projectId}`;
        const startedAt = new Date().toISOString();
        try {
            await createSessionWithEvent(db, {
                session_id: sessionId,
                project_id: projectId,
                branch: null,
                status: 'active',
                started_at: startedAt,
                ended_at: null,
                is_pinned: true,
                source: 'vscode',
            });
            await ensureDispatchCandidateEvent(sessionId);
            await this.context.globalState.update('signalforge.activeSession', sessionId);
            await this.context.globalState.update('signalforge.captureSessionSeed', {
                session_id: sessionId,
                project_id: projectId,
                project_label: projectLabel,
                workspace_root: workspaceRoot,
                seeded_at: startedAt,
                reused: false,
            });
            return { ok: true, sessionId };
        }
        catch (error) {
            return { ok: false, reason: `session seed failed: ${String(error)}` };
        }
    }
    async emitBootstrapAuthority(projectId, projectLabel, workspaceRoot) {
        try {
            // Push-first: emit bootstrap authority event immediately after successful bootstrap
            // Native host caches this so Chrome can receive it on init or persistent connection
            // If event is missed, fallback query on Chrome init will recover state
            const markerData = {
                type: 'bootstrap_authority',
                project_id: projectId,
                project_label: projectLabel,
                authority: 'vscode',
                timestamp: new Date().toISOString(),
                workspace_root: workspaceRoot,
            };
            // Store in globalState as immediate marker
            await this.context.globalState.update('signalforge.bootstrapAuthorityMarker', markerData);
            // Also update core DB so native host cache stays fresh for fallback queries
            try {
                const db = this.openCoreDatabase('sessionBootstrapService.emitBootstrapAuthority');
                if (db.run) {
                    db.run(`INSERT OR REPLACE INTO projects (project_id, name, git_root, workspace_uri, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?)`, [projectId, projectLabel, workspaceRoot, workspaceRoot, new Date().toISOString(), new Date().toISOString()], () => { });
                }
            }
            catch (dbErr) {
                // DB update is optional; does not block propagation
                console.log('[SignalForge] bootstrap authority DB update skipped:', String(dbErr));
            }
            // Emit explicit bootstrap authority event for native host push delivery.
            // Native host polls this signal and forwards to connected Chrome background.
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const path = require('path');
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const fs = require('fs/promises');
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { getDefaultDbPath } = require('@signalforge/core/dist/storage/db');
                const dbPath = getDefaultDbPath();
                const dbDir = path.dirname(dbPath);
                const eventFile = path.join(dbDir, 'bootstrap-authority-event.json');
                const dir = path.dirname(eventFile);
                console.log('[SignalForge] bootstrap authority signal write path', { eventFile, dbPath, dbDir });
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(eventFile, JSON.stringify(markerData), 'utf8');
                console.log('[SignalForge] bootstrap authority signal write complete', { eventFile });
            }
            catch (eventErr) {
                // Signal write is best-effort; fallback query path still recovers state.
                console.log('[SignalForge] bootstrap authority signal write failed:', String(eventErr));
            }
            // Log push event for observability — spec §4 required log
            console.log('[SignalForge] bootstrap authority emitted', {
                project_id: projectId,
                project_label: projectLabel,
                authority: 'vscode',
                workspace_root: workspaceRoot,
            });
        }
        catch (err) {
            // Best-effort push; does not block bootstrap
            // Fallback query on Chrome init will recover
            console.log('[SignalForge] bootstrap authority signal failed (will recover via fallback query):', String(err));
        }
    }
}
exports.SessionBootstrapService = SessionBootstrapService;

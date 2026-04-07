"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileDispatch = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chatEventRepository_1 = require("../repositories/chatEventRepository");
const helpers_1 = require("../events/helpers");
function ensureDir(p) {
    if (!fs_1.default.existsSync(p))
        fs_1.default.mkdirSync(p, { recursive: true });
}
function parseContent(raw) {
    if (!raw)
        return null;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        }
        catch (e) {
            return { summary: String(raw) };
        }
    }
    return raw;
}
function hasUndefinedValues(value) {
    if (value === undefined)
        return true;
    if (Array.isArray(value))
        return value.some((item) => hasUndefinedValues(item));
    if (value && typeof value === 'object') {
        return Object.values(value).some((item) => hasUndefinedValues(item));
    }
    return false;
}
function normalizeContent(raw) {
    if (raw === null || raw === undefined)
        return null;
    if (typeof raw === 'string') {
        const text = raw.trim();
        return text ? { summary: text } : null;
    }
    if (typeof raw !== 'object') {
        return { summary: String(raw) };
    }
    if (hasUndefinedValues(raw))
        return null;
    const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
    if (!summary)
        return null;
    const details = typeof raw.details === 'string' ? raw.details : undefined;
    const status = typeof raw.status === 'string' ? raw.status : undefined;
    const artifacts = Array.isArray(raw.artifacts)
        ? raw.artifacts.filter((v) => typeof v === 'string')
        : undefined;
    return {
        summary,
        details,
        status,
        artifacts: artifacts && artifacts.length ? artifacts : undefined,
    };
}
function normalizeRowToEvent(row, chatThreadId) {
    if (!row || !(0, helpers_1.isAllowedEventRole)(row.role) || !row.event_type)
        return null;
    const parsed = parseContent(row.content);
    const content = normalizeContent(parsed);
    if (!content)
        return null;
    const timestamp = row.timestamp || row.created_at || new Date().toISOString();
    return {
        event_id: row.event_id || `legacy_${Math.random().toString(36).slice(2, 9)}`,
        thread_id: row.thread_id || row.chat_thread_id || chatThreadId,
        project_id: row.project_id || 'unknown-project',
        session_id: row.session_id || undefined,
        dispatch_id: row.dispatch_id || undefined,
        source: row.source || 'cli',
        role: row.role,
        event_type: row.event_type,
        content,
        timestamp,
    };
}
async function compileDispatch(chatThreadId, db, options) {
    const rawEvents = await (0, chatEventRepository_1.getChatEventsByThread)(db, chatThreadId);
    const events = [];
    let skippedLegacyOrInvalid = 0;
    rawEvents.forEach((row) => {
        const normalized = normalizeRowToEvent(row, chatThreadId);
        if (!normalized) {
            skippedLegacyOrInvalid += 1;
            return;
        }
        events.push(normalized);
    });
    // Build a simple contract from events: title + chronological messages
    const title = `Dispatch: ${chatThreadId}`;
    const projectId = options?.projectId || events[0]?.project_id || 'unknown-project';
    const dispatchId = events[0]?.dispatch_id || `dsp_${chatThreadId}`;
    const lines = [];
    lines.push(`# ${title}`);
    lines.push('');
    lines.push('## Project Context');
    lines.push('');
    lines.push(`- project_id: ${projectId}`);
    lines.push(`- session_id: ${options?.sessionId || events[0]?.session_id || 'none'}`);
    lines.push(`- dispatch_id: ${dispatchId}`);
    lines.push('');
    lines.push('## Captured Events');
    lines.push('');
    lines.push(`- Skipped Legacy/Invalid Events: ${skippedLegacyOrInvalid}`);
    lines.push('');
    events.forEach((e, i) => {
        lines.push(`### Event ${i + 1} — ${e.event_type} (${e.timestamp})`);
        lines.push('');
        lines.push(`- role: ${e.role}`);
        lines.push(`- source: ${e.source}`);
        lines.push(`- summary: ${e.content.summary}`);
        if (e.content.details)
            lines.push(`- details: ${e.content.details}`);
        if (e.content.status)
            lines.push(`- status: ${e.content.status}`);
        if (e.content.artifacts && e.content.artifacts.length)
            lines.push(`- artifacts: ${e.content.artifacts.join(', ')}`);
        lines.push('');
    });
    // prompt: aggregate user messages
    const promptLines = [];
    promptLines.push(`# Prompt for ${chatThreadId}`);
    promptLines.push('');
    const userMsgs = events.filter((x) => x.role === 'user' || x.role === 'worker');
    userMsgs.forEach((m) => {
        promptLines.push(`> ${m.content.summary}`);
        if (m.content.details)
            promptLines.push('', m.content.details, '');
    });
    // copilot instructions: deterministic short template
    const copilot = [];
    copilot.push('You are Copilot. Materialize the following dispatch into repository files.');
    copilot.push('Follow SIGNALFORGE contract conventions.');
    copilot.push('');
    copilot.push('Dispatch summary:');
    copilot.push('');
    copilot.push(`Skipped Legacy/Invalid Events: ${skippedLegacyOrInvalid}`);
    copilot.push('');
    copilot.push(events.map((e) => `- ${e.event_type}: ${String(e.content.summary).slice(0, 120)}`).join('\n'));
    // write files
    const base = options && options.targetDir ? path_1.default.resolve(options.targetDir) : process.cwd();
    const contractDir = path_1.default.resolve(base, 'docs', 'contracts');
    const promptsDir = path_1.default.resolve(base, 'docs', 'prompts');
    const copilotDir = path_1.default.resolve(base, '.github');
    ensureDir(contractDir);
    ensureDir(promptsDir);
    ensureDir(copilotDir);
    const contractPath = path_1.default.join(contractDir, `${chatThreadId}.md`);
    const promptPath = path_1.default.join(promptsDir, `${chatThreadId}.md`);
    const copilotPath = path_1.default.join(copilotDir, 'copilot-instructions.md');
    if (options && (options.projectId || options.sessionId)) {
        try {
            const meta = {
                chatThreadId,
                generatedAt: new Date().toISOString(),
            };
            if (options.projectId)
                meta.projectId = options.projectId;
            if (options.sessionId)
                meta.sessionId = options.sessionId;
            fs_1.default.writeFileSync(path_1.default.join(contractDir, `${chatThreadId}.meta.json`), JSON.stringify(meta, null, 2));
        }
        catch (e) {
            // ignore metadata write failures
        }
    }
    fs_1.default.writeFileSync(contractPath, lines.join('\n'));
    fs_1.default.writeFileSync(promptPath, promptLines.join('\n'));
    fs_1.default.writeFileSync(copilotPath, copilot.join('\n'));
    return { contractPath, promptPath, copilotPath };
}
exports.compileDispatch = compileDispatch;

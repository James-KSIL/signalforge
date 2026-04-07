"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestChatEvent = void 0;
const chatEventRepository_1 = require("../repositories/chatEventRepository");
const cliAdapter_1 = require("./adapters/cliAdapter");
const vscodeAdapter_1 = require("./adapters/vscodeAdapter");
const browserAdapter_1 = require("./adapters/browserAdapter");
async function ingestChatEvent(db, row) {
    const normalizedSource = row.source || 'cli';
    const adapterInput = {
        thread_id: row.chat_thread_id,
        project_id: row.project_id,
        session_id: row.session_id || undefined,
        dispatch_id: row.dispatch_id || undefined,
        role: row.role,
        event_type: row.event_type,
        content: typeof row.content === 'string' ? (() => {
            try {
                return JSON.parse(row.content);
            }
            catch {
                return { summary: String(row.content || '') };
            }
        })() : row.content,
        source_url: row.source_url,
        matched_trigger: row.matched_trigger,
    };
    const evt = normalizedSource === 'vscode'
        ? (0, vscodeAdapter_1.vscodeAdapter)(adapterInput).event
        : normalizedSource === 'browser'
            ? (0, browserAdapter_1.browserAdapter)(adapterInput).event
            : (0, cliAdapter_1.cliAdapter)(adapterInput).event;
    await (0, chatEventRepository_1.insertChatEvent)(db, {
        event_id: evt.event_id,
        chat_thread_id: evt.thread_id,
        project_id: evt.project_id,
        session_id: evt.session_id,
        dispatch_id: evt.dispatch_id,
        source: evt.source,
        turn_index: (row.turn_index || 0),
        role: evt.role,
        event_type: evt.event_type,
        content: JSON.stringify(evt.content),
        artifact_refs: evt.content.artifact_refs ? JSON.stringify(evt.content.artifact_refs) : null,
        source_url: row.source_url,
        matched_trigger: row.matched_trigger,
        created_at: evt.timestamp,
    });
}
exports.ingestChatEvent = ingestChatEvent;

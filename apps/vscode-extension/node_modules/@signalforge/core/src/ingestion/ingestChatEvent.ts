import type { ChatEventRow } from '@signalforge/shared/dist/types/entities';
import { insertChatEvent } from '../repositories/chatEventRepository';
import { cliAdapter } from './adapters/cliAdapter';
import { vscodeAdapter } from './adapters/vscodeAdapter';
import { browserAdapter } from './adapters/browserAdapter';
import { AdapterInput } from './adapters/types';

export async function ingestChatEvent(db: any, row: Partial<ChatEventRow & { content?: any }>): Promise<void> {
  const normalizedSource = row.source || 'cli';
  const adapterInput: AdapterInput = {
    thread_id: row.chat_thread_id!,
    project_id: row.project_id!,
    session_id: row.session_id || undefined,
    dispatch_id: row.dispatch_id || undefined,
    role: row.role as any,
    event_type: row.event_type as any,
    content: typeof row.content === 'string' ? (() => {
      try { return JSON.parse(row.content as string); } catch { return { summary: String(row.content || '') }; }
    })() : (row.content as any),
    source_url: row.source_url,
    matched_trigger: row.matched_trigger,
  };

  const evt = normalizedSource === 'vscode'
    ? vscodeAdapter(adapterInput).event
    : normalizedSource === 'browser'
      ? browserAdapter(adapterInput).event
      : cliAdapter(adapterInput).event;

  await insertChatEvent(db, {
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
  } as any);
}

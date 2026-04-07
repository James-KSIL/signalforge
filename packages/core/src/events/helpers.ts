import { ForgeEvent, EventRole, EventSource } from './event.types';

export const ALLOWED_EVENT_ROLES: EventRole[] = ['system', 'user', 'assistant', 'worker', 'observer', 'outcome'];

export function isAllowedEventRole(role?: string): role is EventRole {
  return !!role && ALLOWED_EVENT_ROLES.includes(role as EventRole);
}

export function generateId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
}

export function toDispatchId(dispatchThreadId?: string | null): string | undefined {
  if (!dispatchThreadId) return undefined;
  const normalized = String(dispatchThreadId).trim();
  if (!normalized) return undefined;
  return `dsp_${normalized}`;
}

export function normalizeRole(role?: string): EventRole {
  return isAllowedEventRole(role) ? role : 'system';
}

// Read-side safe role normalizer
export function safeRole(role?: string): EventRole {
  return isAllowedEventRole(role) ? role : 'system';
}

function hasUndefinedValues(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some((item) => hasUndefinedValues(item));
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasUndefinedValues(item));
  }
  return false;
}

// Read-side assertion to ensure events are valid before transformation
export function assertValidEvent(e: Partial<ForgeEvent>): ForgeEvent {
  if (!e.thread_id) {
    throw new Error('Invalid event: missing thread_id');
  }
  if (!e.project_id) {
    throw new Error('Invalid event: missing project_id');
  }
  if (!e.source) {
    throw new Error('Invalid event: missing source');
  }
  if (!e.content || !e.content.summary) {
    throw new Error('Invalid event: missing content.summary');
  }

  // At this point, cast is safe for downstream consumers
  return e as ForgeEvent;
}

export function createEvent(input: Partial<ForgeEvent>): ForgeEvent {
  if (!input.role || !isAllowedEventRole(input.role)) {
    throw new Error(`Event role must be one of: ${ALLOWED_EVENT_ROLES.join(', ')}`);
  }
  if (!input.event_type || typeof input.event_type !== 'string') {
    throw new Error('Event must include event_type');
  }
  if (!input.content || typeof input.content.summary !== 'string' || !input.content.summary.trim()) {
    throw new Error('Event must include summary');
  }
  if (!input.thread_id) {
    throw new Error('Event must include thread_id');
  }
  if (!input.project_id || typeof input.project_id !== 'string' || !input.project_id.trim()) {
    throw new Error('Event must include non-null project_id');
  }
  const allowedSources: EventSource[] = ['vscode', 'browser', 'cli'];
  if (!input.source || !allowedSources.includes(input.source)) {
    throw new Error(`Event source must be one of: ${allowedSources.join(', ')}`);
  }
  if (input.dispatch_id !== undefined && (typeof input.dispatch_id !== 'string' || !input.dispatch_id.trim())) {
    throw new Error('dispatch_id must be a non-empty string when provided');
  }
  if (input.content?.artifact_refs !== undefined) {
    if (!Array.isArray(input.content.artifact_refs) || input.content.artifact_refs.some((x) => typeof x !== 'string' || !x.trim())) {
      throw new Error('artifact_refs must be an array of non-empty strings when provided');
    }
  }
  if (hasUndefinedValues(input.content)) {
    throw new Error('Event content cannot include undefined values');
  }

  return {
    event_id: generateId(),
    thread_id: input.thread_id!,
    project_id: input.project_id!,
    session_id: input.session_id,
    dispatch_id: input.dispatch_id,
    source: input.source,
    role: input.role,
    event_type: input.event_type!,
    content: input.content!,
    timestamp: new Date().toISOString(),
  };
}

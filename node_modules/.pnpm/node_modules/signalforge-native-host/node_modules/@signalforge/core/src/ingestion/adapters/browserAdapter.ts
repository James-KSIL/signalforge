import { createEvent } from '../../events/helpers';
import { AdapterInput, AdapterResult } from './types';

function normalizeContent(input: AdapterInput): any {
  if (typeof input.content === 'string') {
    const text = input.content.trim();
    return { summary: text || '[empty summary]' };
  }
  const contentObj = input.content as any;
  const normalized: Record<string, unknown> = {
    ...contentObj,
  };

  const artifactRefs = input.artifact_refs ?? contentObj.artifact_refs;
  if (artifactRefs !== undefined) {
    normalized.artifact_refs = artifactRefs;
  }

  return normalized;
}

// Browser ingestion is intentionally a controlled stub in Phase 3.
export function browserAdapter(input: AdapterInput): AdapterResult {
  const event = createEvent({
    thread_id: input.thread_id,
    project_id: input.project_id,
    session_id: input.session_id,
    dispatch_id: input.dispatch_id,
    source: 'browser',
    role: input.role,
    event_type: input.event_type,
    content: normalizeContent(input),
  });

  return { event, source: 'browser' };
}

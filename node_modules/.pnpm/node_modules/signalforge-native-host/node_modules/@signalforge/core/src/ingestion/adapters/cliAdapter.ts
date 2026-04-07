import { createEvent } from '../../events/helpers';
import { AdapterInput, AdapterResult } from './types';

function normalizeContent(input: AdapterInput): any {
  if (typeof input.content === 'string') {
    const text = input.content.trim();
    return { summary: text || '[empty summary]' };
  }
  const contentObj = input.content as any;
  return {
    ...contentObj,
    artifact_refs: input.artifact_refs || contentObj.artifact_refs,
  };
}

export function cliAdapter(input: AdapterInput): AdapterResult {
  const event = createEvent({
    thread_id: input.thread_id,
    project_id: input.project_id,
    session_id: input.session_id,
    dispatch_id: input.dispatch_id,
    source: 'cli',
    role: input.role,
    event_type: input.event_type,
    content: normalizeContent(input),
  });

  return { event, source: 'cli' };
}

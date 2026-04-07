import { createEvent } from './helpers';
import { EventContent } from './event.types';

export type OutcomeInput = {
  projectId: string;
  sessionId?: string;
  dispatchId?: string;
  source: 'vscode' | 'browser' | 'cli';
  status: 'success' | 'fail' | 'partial';
  title: string;
  whatChanged: string;
  resistance?: string;
  nextStep: string;
};

export function buildOutcomeEvent(thread_id: string, input: OutcomeInput) {
  const details = [`WHAT CHANGED:`, input.whatChanged, '', `RESISTANCE:`, input.resistance ?? 'none', '', `NEXT STEP:`, input.nextStep].join('\n');

  const content: EventContent = {
    summary: input.title,
    status: input.status,
    details: details.trim(),
  };

  return createEvent({
    thread_id,
    project_id: input.projectId,
    session_id: input.sessionId,
    dispatch_id: input.dispatchId,
    source: input.source,
    role: 'outcome',
    event_type: 'outcome_logged',
    content,
  });
}

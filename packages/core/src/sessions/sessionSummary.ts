import { ForgeEvent } from '../events/event.types';
import { isAllowedEventRole } from '../events/helpers';
import { normalizeOutcome, RenderableOutcome } from '../artifacts/outcomeNormalization';

export function buildSessionSummary(events: ForgeEvent[], options?: { includeEventTrace?: boolean }) {
  let skippedLegacyOrInvalid = 0;
  const validEvents = events.filter((e: any) => {
    const ok = !!e
      && isAllowedEventRole(e.role)
      && !!e.content
      && typeof e.content.summary === 'string'
      && !!e.content.summary.trim();
    if (!ok) skippedLegacyOrInvalid += 1;
    return ok;
  });

  const highlights = validEvents.map(e => {
    const status = typeof e.content.status === 'string' && e.content.status ? e.content.status : 'info';
    const summary = e.content.summary;
    return `- [${status}] (${e.role}) ${summary}`;
  });

  const outcomeRows = events.filter((e: any) => e && e.role === 'outcome');
  let skippedInvalidOutcomes = 0;
  const renderableOutcomes: RenderableOutcome[] = outcomeRows.map((e: any) => {
    const normalized = normalizeOutcome({
      ...(e && e.content ? e.content : {}),
      status: e?.content?.status,
      created_at: e?.timestamp || e?.created_at,
    });

    if (!normalized) {
      skippedInvalidOutcomes += 1;
      return null;
    }

    return normalized;
  }).filter((o: RenderableOutcome | null): o is RenderableOutcome => !!o);

  const outcomeLines = renderableOutcomes.map((o) => `- [${o.status}] ${o.summary} (${o.created_at})`);
  const projectId = validEvents[0]?.project_id ?? 'unknown-project';
  const sessionId = validEvents[0]?.session_id ?? validEvents[0]?.thread_id ?? 'unknown-thread';
  const dispatchId = validEvents.find((e) => !!e.dispatch_id)?.dispatch_id ?? 'none';
  const traceLines = validEvents
    .slice(0, 12)
    .map((e) => `- ${e.timestamp} | ${e.source} | ${e.event_type} | ${e.content.summary}`);

  return [
    `Session Summary for ${validEvents[0]?.thread_id ?? 'unknown-thread'}`,
    '',
    'Project Context',
    '',
    `- project_id: ${projectId}`,
    `- session_id: ${sessionId}`,
    `- dispatch_id: ${dispatchId}`,
    '',
    `Skipped Legacy/Invalid Events: ${skippedLegacyOrInvalid}`,
    '',
    'Highlights',
    '',
    ...highlights,
    '',
    'Outcome Summary',
    '',
    `- totalOutcomes: ${outcomeRows.length}`,
    `- renderedOutcomes: ${renderableOutcomes.length}`,
    `- Skipped Legacy/Invalid Outcomes: ${skippedInvalidOutcomes}`,
    '',
    ...(outcomeLines.length ? outcomeLines : ['- none']),
    ...(options?.includeEventTrace
      ? [
          '',
          'Event Trace (compact)',
          '',
          ...(traceLines.length ? traceLines : ['- none']),
        ]
      : []),
  ].join('\n');
}

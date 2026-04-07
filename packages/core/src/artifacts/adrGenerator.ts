import { ForgeEvent } from '../events/event.types';
import { isAllowedEventRole } from '../events/helpers';
import { normalizeOutcome, RenderableOutcome } from './outcomeNormalization';

function isRenderableEvent(e: any): e is ForgeEvent {
  return !!e
    && isAllowedEventRole(e.role)
    && !!e.content
    && typeof e.content.summary === 'string'
    && !!e.content.summary.trim();
}

export function buildADR(events: ForgeEvent[]) {
  let skippedLegacyOrInvalid = 0;
  const validEvents = events.filter((e) => {
    const ok = isRenderableEvent(e);
    if (!ok) skippedLegacyOrInvalid += 1;
    return ok;
  });

  const outcomeRows = events.filter((e: any) => e && e.role === 'outcome');
  let skippedInvalidOutcomes = 0;
  const outcomes: RenderableOutcome[] = outcomeRows.map((e: any) => {
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

  const thread = validEvents[0]?.thread_id ?? 'unknown-thread';
  const projectId = validEvents[0]?.project_id ?? 'unknown-project';
  const sessionId = validEvents[0]?.session_id ?? 'none';
  const dispatchId = validEvents.find((e) => !!e.dispatch_id)?.dispatch_id ?? 'none';

  const decisions = outcomes.map(o => {
    const summary = o.summary;
    return `- ${summary}`;
  }).join('\n') || '- none';

  const outcomesText = outcomes.map(o => {
    const summary = o.summary;
    const status = o.status;
    const details = o.details || '[no details provided]';
    return `\n### ${summary}\n- Status: ${status}\n- Created At: ${o.created_at}\n- Details:\n${details}\n`;
  }).join('\n') || '- none';

  const dispatchSummary = validEvents
    .filter((e) => e.dispatch_id)
    .slice(0, 3)
    .map((e) => `- ${e.event_type}: ${e.content.summary}`)
    .join('\n') || '- none';

  return `\n# ADR: ${thread}\n\n## Project Context\n- project_id: ${projectId}\n- session_id: ${sessionId}\n\n## Dispatch Context\n- dispatch_id: ${dispatchId}\n${dispatchSummary}\n\n## Context\nSession activity captured through SignalForge pipeline.\n\n- Skipped Legacy/Invalid Events: ${skippedLegacyOrInvalid}\n\n## Decisions\n${decisions}\n\n## Outcomes\n- totalOutcomes: ${outcomeRows.length}\n- renderedOutcomes: ${outcomes.length}\n- Skipped Legacy/Invalid Outcomes: ${skippedInvalidOutcomes}\n\n${outcomesText}\n## Consequences\n- Deterministic logging pipeline validated\n- Event enrichment layer operational\n`;
}

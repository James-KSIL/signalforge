export type RenderableOutcome = {
  status: 'success' | 'fail' | 'partial' | 'blocked' | 'unknown';
  summary: string;
  details?: string;
  created_at: string;
};

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === 'null' || trimmed === 'undefined') return undefined;
  return trimmed;
}

function parseContent(raw: unknown): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, any>) : null;
}

function normalizeOutcomeStatus(status: unknown): RenderableOutcome['status'] {
  if (typeof status !== 'string') return 'unknown';
  const normalized = status.trim().toLowerCase();
  if (normalized === 'success' || normalized === 'fail' || normalized === 'partial' || normalized === 'blocked' || normalized === 'unknown') {
    return normalized;
  }
  if (normalized === 'failed' || normalized === 'failure' || normalized === 'error') return 'fail';
  if (normalized === 'done' || normalized === 'completed') return 'success';
  if (normalized === 'in_progress' || normalized === 'in-progress') return 'partial';
  return 'unknown';
}

function composeDetails(whatChanged?: string, whatBroke?: string, nextStep?: string): string | undefined {
  const lines: string[] = [];
  if (whatChanged) {
    lines.push('WHAT CHANGED:');
    lines.push(whatChanged);
  }
  if (whatBroke) {
    if (lines.length) lines.push('');
    lines.push('RESISTANCE:');
    lines.push(whatBroke);
  }
  if (nextStep) {
    if (lines.length) lines.push('');
    lines.push('NEXT STEP:');
    lines.push(nextStep);
  }
  return lines.length ? lines.join('\n') : undefined;
}

export function normalizeOutcome(row: any): RenderableOutcome | null {
  if (!row) return null;

  const content = parseContent(row.content);

  const title = cleanText(row.title) || cleanText(content?.title) || cleanText(content?.summary);
  const whatChanged = cleanText(row.what_changed) || cleanText(content?.what_changed) || cleanText(content?.whatChanged);
  const whatBroke = cleanText(row.what_broke) || cleanText(content?.what_broke) || cleanText(content?.whatBroke) || cleanText(content?.resistance);
  const nextStep = cleanText(row.next_step) || cleanText(content?.next_step) || cleanText(content?.nextStep);
  const directDetails = cleanText(content?.details);
  const eventSummary = cleanText((row as any)?.summary) || cleanText(content?.summary);

  const hasMeaningfulText = !!(
    eventSummary ||
    title ||
    whatChanged ||
    whatBroke ||
    nextStep ||
    directDetails
  );
  if (!hasMeaningfulText) return null;

  return {
    status: normalizeOutcomeStatus(row.status ?? content?.status),
    summary: eventSummary || title || whatChanged || nextStep || '[missing outcome summary]',
    details: directDetails || composeDetails(whatChanged, whatBroke, nextStep),
    created_at: cleanText(row.created_at) || cleanText(row.timestamp) || cleanText(content?.created_at) || new Date().toISOString(),
  };
}

export function isRenderableOutcome(row: any): boolean {
  return normalizeOutcome(row) !== null;
}

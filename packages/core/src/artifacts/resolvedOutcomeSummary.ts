import type { CopilotCandidateStagingRow } from '../repositories/copilotCandidateRepository';
import type { CopilotExecutionArtifactRow } from '../repositories/copilotArtifactRepository';
import type { OutcomeLogRow } from '../repositories/outcomeLogRepository';

export type ResolvedOutcomeContractRow = {
  event_id: string;
  created_at: string;
  content: string;
};

export type ResolvedOutcomeSummaryInput = {
  outcome: OutcomeLogRow;
  candidate: CopilotCandidateStagingRow;
  artifact: CopilotExecutionArtifactRow | null;
  contract: ResolvedOutcomeContractRow | null;
};

export type ResolvedOutcomeSummary = {
  outcome_id: string;
  outcome_status: OutcomeLogRow['outcome_status'];
  dispatch_id: string;
  candidate_id: string;
  contract_ref: string | null;
  contract_summary: string | null;
  artifact_ref: string | null;
  rejection_reason: string | null;
  affected_file_refs: string[];
  explanation: string;
  summary_text: string;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseJsonStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => cleanText(item))
      .filter((item): item is string => !!item);
  } catch {
    return [];
  }
}

function parseContractSummary(contract: ResolvedOutcomeContractRow | null): string | null {
  if (!contract) return null;
  const content = cleanText(contract.content);
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      return cleanText(parsed.summary) || cleanText(parsed.details) || content;
    }
  } catch {
    // fall through to raw content
  }

  return content;
}

function summarizeReason(input: ResolvedOutcomeSummaryInput): string {
  const rejectionReason = cleanText(input.outcome.rejection_reason)
    || cleanText(input.candidate.rejection_reason)
    || cleanText(input.candidate.gate_failure_reason);

  if (input.outcome.outcome_status === 'success') {
    return 'Candidate promoted after validation resolved and the promoted artifact was written.';
  }

  if (input.outcome.outcome_status === 'partial') {
    return rejectionReason
      ? `Candidate resolved with partial outcome: ${rejectionReason}.`
      : 'Candidate resolved with partial outcome.';
  }

  return rejectionReason
    ? `Candidate rejected because ${rejectionReason}.`
    : 'Candidate rejected after deterministic validation failed.';
}

function resolveAffectedFileRefs(input: ResolvedOutcomeSummaryInput): string[] {
  const fromArtifact = parseJsonStringArray(input.artifact?.extracted_file_refs_json || null);
  if (fromArtifact.length) {
    return fromArtifact;
  }

  return [];
}

function formatSummaryText(summary: ResolvedOutcomeSummary): string {
  const fileRefs = summary.affected_file_refs.length ? summary.affected_file_refs : ['none'];
  return [
    'Resolved Outcome Summary',
    `- outcome_status: ${summary.outcome_status}`,
    `- dispatch_id: ${summary.dispatch_id}`,
    `- candidate_id: ${summary.candidate_id}`,
    `- contract_ref: ${summary.contract_ref ?? 'none'}`,
    `- contract_summary: ${summary.contract_summary ?? 'none'}`,
    `- artifact_ref: ${summary.artifact_ref ?? 'none'}`,
    `- rejection_reason: ${summary.rejection_reason ?? 'none'}`,
    '- affected_file_refs:',
    ...fileRefs.map((fileRef) => `  - ${fileRef}`),
    `- explanation: ${summary.explanation}`,
  ].join('\n');
}

export function buildResolvedOutcomeSummary(input: ResolvedOutcomeSummaryInput): ResolvedOutcomeSummary {
  const rejectionReason = cleanText(input.outcome.rejection_reason)
    || cleanText(input.candidate.rejection_reason)
    || cleanText(input.candidate.gate_failure_reason);
  const affectedFileRefs = resolveAffectedFileRefs(input);
  const explanation = summarizeReason(input);
  const contractSummary = parseContractSummary(input.contract);

  const summary: ResolvedOutcomeSummary = {
    outcome_id: input.outcome.outcome_id,
    outcome_status: input.outcome.outcome_status,
    dispatch_id: cleanText(input.outcome.dispatch_id) || 'unknown-dispatch',
    candidate_id: cleanText(input.outcome.candidate_id) || cleanText(input.candidate.candidate_id) || 'unknown-candidate',
    contract_ref: cleanText(input.outcome.contract_ref) || cleanText(input.candidate.contract_ref),
    contract_summary: contractSummary,
    artifact_ref: cleanText(input.outcome.artifact_ref) || cleanText(input.artifact?.artifact_id),
    rejection_reason: rejectionReason,
    affected_file_refs: affectedFileRefs,
    explanation,
    summary_text: '',
  };

  summary.summary_text = formatSummaryText(summary);
  return summary;
}
import { createHash } from 'crypto';
import type { CopilotCandidateStagingRow } from '../repositories/copilotCandidateRepository';
import type { CopilotExecutionArtifactRow } from '../repositories/copilotArtifactRepository';
import type { OutcomeLogRow } from '../repositories/outcomeLogRepository';

export type DeterministicAdrContractRow = {
  event_id: string;
  created_at: string;
  content: string;
};

export type DeterministicAdrInput = {
  outcome: OutcomeLogRow;
  candidate: CopilotCandidateStagingRow;
  artifact: CopilotExecutionArtifactRow | null;
  contract: DeterministicAdrContractRow | null;
};

export type DeterministicAdrDecision = 'PROMOTED' | 'REJECTED';

export type DeterministicAdrRender = {
  adr_id: string;
  markdown: string;
  decision: DeterministicAdrDecision;
};

type ExecutionSignals = Record<string, boolean | string | number>;

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseJsonObject(value: string | null | undefined): Record<string, any> | null {
  const source = cleanText(value);
  if (!source) return null;
  try {
    const parsed = JSON.parse(source);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonStringArray(value: string | null | undefined): string[] {
  const source = cleanText(value);
  if (!source) return [];

  try {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => cleanText(item))
      .filter((item): item is string => !!item);
  } catch {
    return [];
  }
}

function parseContractSummary(contract: DeterministicAdrContractRow | null): string | null {
  if (!contract) return null;
  const content = cleanText(contract.content);
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      return content;
    }
    return cleanText((parsed as Record<string, unknown>).summary)
      || cleanText((parsed as Record<string, unknown>).details)
      || content;
  } catch {
    return content;
  }
}

function parseGatePass(value: number | null): string {
  if (value === 1) return 'true';
  if (value === 0) return 'false';
  return 'null';
}

function parseFailedInvariants(raw: string | null): string[] {
  const values = parseJsonStringArray(raw);
  return Array.from(new Set(values)).sort();
}

function readExecutionSignalsFromObject(source: Record<string, any> | null): ExecutionSignals {
  if (!source) return {};

  const candidates: unknown[] = [
    source.executionSignals,
    source.execution_signals,
    source.contract_gate?.executionSignals,
    source.contract_gate?.execution_signals,
  ];

  const resolved = candidates.find((entry) => !!entry && typeof entry === 'object') as Record<string, unknown> | undefined;
  if (!resolved) return {};

  const normalized: ExecutionSignals = {};
  const keys = Object.keys(resolved).sort();
  for (const key of keys) {
    const value = resolved[key];
    if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
      normalized[key] = value;
    }
  }
  return normalized;
}

function resolveExecutionSignals(input: DeterministicAdrInput): ExecutionSignals {
  const artifactEvidence = parseJsonObject(input.artifact?.validation_evidence_json || null);
  const candidateFlags = parseJsonObject(input.candidate.signal_flags_json || null);

  const fromArtifact = readExecutionSignalsFromObject(artifactEvidence);
  if (Object.keys(fromArtifact).length > 0) {
    return fromArtifact;
  }

  const fromCandidate = readExecutionSignalsFromObject(candidateFlags);
  if (Object.keys(fromCandidate).length > 0) {
    return fromCandidate;
  }

  return {};
}

function toLines(label: string, values: string[]): string[] {
  if (!values.length) {
    return [`- ${label}: []`];
  }
  return [
    `- ${label}:`,
    ...values.map((value) => `  - ${value}`),
  ];
}

function formatNullable(value: string | null): string {
  return value === null ? 'null' : value;
}

function formatNullableArray(values: string[]): string {
  if (!values.length) return 'null';
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

function getDecision(input: DeterministicAdrInput): DeterministicAdrDecision {
  const candidatePromoted = input.candidate.validation_status === 'promoted';
  const outcomePromoted = input.outcome.outcome_status === 'success';
  return candidatePromoted || outcomePromoted ? 'PROMOTED' : 'REJECTED';
}

function resolveArtifactRef(input: DeterministicAdrInput, decision: DeterministicAdrDecision): string | null {
  if (decision !== 'PROMOTED') return null;
  return cleanText(input.outcome.artifact_ref)
    || cleanText(input.artifact?.artifact_id)
    || null;
}

function resolveAffectedFileRefs(input: DeterministicAdrInput, decision: DeterministicAdrDecision): string[] {
  if (decision !== 'PROMOTED') return [];
  const values = parseJsonStringArray(input.artifact?.extracted_file_refs_json || null);
  return Array.from(new Set(values)).sort();
}

function resolveCandidateId(input: DeterministicAdrInput): string {
  return cleanText(input.outcome.candidate_id)
    || cleanText(input.candidate.candidate_id)
    || 'unknown-candidate';
}

function resolveDispatchId(input: DeterministicAdrInput): string {
  return cleanText(input.outcome.dispatch_id)
    || cleanText(input.candidate.dispatch_id)
    || 'unknown-dispatch';
}

function resolveContractRef(input: DeterministicAdrInput): string | null {
  return cleanText(input.outcome.contract_ref)
    || cleanText(input.candidate.contract_ref)
    || null;
}

function resolveTimestamp(input: DeterministicAdrInput): string {
  return cleanText(input.outcome.created_at)
    || cleanText(input.candidate.captured_at)
    || cleanText(input.contract?.created_at)
    || 'unknown-timestamp';
}

function computeAdrId(candidateId: string, artifactRef: string | null, outcomeId: string, decision: DeterministicAdrDecision): string {
  const source = decision === 'PROMOTED'
    ? `${candidateId}|${artifactRef || 'missing-artifact'}`
    : `${candidateId}|${outcomeId}`;
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
  return `adr_v1_${hash}`;
}

export function buildDeterministicAdrV1(input: DeterministicAdrInput): DeterministicAdrRender {
  const decision = getDecision(input);
  const candidateId = resolveCandidateId(input);
  const dispatchId = resolveDispatchId(input);
  const contractRef = resolveContractRef(input);
  const contractSummary = parseContractSummary(input.contract);
  const artifactRef = resolveArtifactRef(input, decision);
  const affectedFileRefs = resolveAffectedFileRefs(input, decision);
  const executionSignals = resolveExecutionSignals(input);
  const failedInvariants = parseFailedInvariants(input.candidate.failed_invariants_json);
  const rejectionReason = cleanText(input.outcome.rejection_reason)
    || cleanText(input.candidate.rejection_reason)
    || cleanText(input.candidate.gate_failure_reason)
    || null;
  const gateFailureReason = cleanText(input.candidate.gate_failure_reason);
  const timestamp = resolveTimestamp(input);
  const adrId = computeAdrId(candidateId, artifactRef, input.outcome.outcome_id, decision);

  const executionSignalKeys = Object.keys(executionSignals).sort();
  const executionSignalLines = executionSignalKeys.length
    ? [
        '- execution_signals:',
        ...executionSignalKeys.map((key) => `  - ${key}: ${String(executionSignals[key])}`),
      ]
    : ['- execution_signals: []'];

  const lines = [
    '# ADR v1',
    '',
    '## Header',
    `- adr_id: ${adrId}`,
    `- timestamp: ${timestamp}`,
    `- dispatch_id: ${dispatchId}`,
    `- candidate_id: ${candidateId}`,
    `- contract_ref: ${formatNullable(contractRef)}`,
    `- artifact_ref: ${formatNullable(artifactRef)}`,
    '',
    '## Context',
    `- contract_summary: ${formatNullable(contractSummary)}`,
    ...toLines('affected_file_refs', affectedFileRefs),
    '',
    '## Decision',
    `- ${decision}`,
    '',
    '## Rationale',
    '- contract_gate_invariants:',
    `  - gate_pass: ${parseGatePass(input.candidate.gate_pass)}`,
    `  - failed_invariants: ${formatNullableArray(failedInvariants)}`,
    `  - gate_failure_reason: ${formatNullable(gateFailureReason)}`,
    ...executionSignalLines,
    `- rejection_reason: ${formatNullable(rejectionReason)}`,
    '',
    '## Evidence',
    `- artifact_id: ${formatNullable(artifactRef)}`,
    `- candidate_id: ${candidateId}`,
    `- dispatch_id: ${dispatchId}`,
    '- evidence_chain:',
    `  - contract_ref: ${formatNullable(contractRef)}`,
    `  - candidate_id: ${candidateId}`,
    `  - artifact_id: ${formatNullable(artifactRef)}`,
    `  - dispatch_id: ${dispatchId}`,
    ...toLines('file_refs', affectedFileRefs),
    ...executionSignalLines,
    '',
    '## Consequences',
    decision === 'PROMOTED'
      ? '- promoted -> artifact accepted'
      : '- candidate rejected; no artifact created',
  ];

  return {
    adr_id: adrId,
    markdown: lines.join('\n'),
    decision,
  };
}

export const renderDeterministicAdr = buildDeterministicAdrV1;

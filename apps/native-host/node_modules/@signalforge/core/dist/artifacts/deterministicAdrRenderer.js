"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDeterministicAdr = exports.buildDeterministicAdrV1 = void 0;
const crypto_1 = require("crypto");
function cleanText(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function parseJsonObject(value) {
    const source = cleanText(value);
    if (!source)
        return null;
    try {
        const parsed = JSON.parse(source);
        return parsed && typeof parsed === 'object' ? parsed : null;
    }
    catch {
        return null;
    }
}
function parseJsonStringArray(value) {
    const source = cleanText(value);
    if (!source)
        return [];
    try {
        const parsed = JSON.parse(source);
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .map((item) => cleanText(item))
            .filter((item) => !!item);
    }
    catch {
        return [];
    }
}
function parseContractSummary(contract) {
    if (!contract)
        return null;
    const content = cleanText(contract.content);
    if (!content)
        return null;
    try {
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') {
            return content;
        }
        return cleanText(parsed.summary)
            || cleanText(parsed.details)
            || content;
    }
    catch {
        return content;
    }
}
function parseGatePass(value) {
    if (value === 1)
        return 'true';
    if (value === 0)
        return 'false';
    return 'null';
}
function parseFailedInvariants(raw) {
    const values = parseJsonStringArray(raw);
    return Array.from(new Set(values)).sort();
}
function readExecutionSignalsFromObject(source) {
    if (!source)
        return {};
    const candidates = [
        source.executionSignals,
        source.execution_signals,
        source.contract_gate?.executionSignals,
        source.contract_gate?.execution_signals,
    ];
    const resolved = candidates.find((entry) => !!entry && typeof entry === 'object');
    if (!resolved)
        return {};
    const normalized = {};
    const keys = Object.keys(resolved).sort();
    for (const key of keys) {
        const value = resolved[key];
        if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
            normalized[key] = value;
        }
    }
    return normalized;
}
function resolveExecutionSignals(input) {
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
function toLines(label, values) {
    if (!values.length) {
        return [`- ${label}: []`];
    }
    return [
        `- ${label}:`,
        ...values.map((value) => `  - ${value}`),
    ];
}
function formatNullable(value) {
    return value === null ? 'null' : value;
}
function formatNullableArray(values) {
    if (!values.length)
        return 'null';
    return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}
function getDecision(input) {
    const candidatePromoted = input.candidate.validation_status === 'promoted';
    const outcomePromoted = input.outcome.outcome_status === 'success';
    return candidatePromoted || outcomePromoted ? 'PROMOTED' : 'REJECTED';
}
function resolveArtifactRef(input, decision) {
    if (decision !== 'PROMOTED')
        return null;
    return cleanText(input.outcome.artifact_ref)
        || cleanText(input.artifact?.artifact_id)
        || null;
}
function resolveAffectedFileRefs(input, decision) {
    if (decision !== 'PROMOTED')
        return [];
    const values = parseJsonStringArray(input.artifact?.extracted_file_refs_json || null);
    return Array.from(new Set(values)).sort();
}
function resolveCandidateId(input) {
    return cleanText(input.outcome.candidate_id)
        || cleanText(input.candidate.candidate_id)
        || 'unknown-candidate';
}
function resolveDispatchId(input) {
    return cleanText(input.outcome.dispatch_id)
        || cleanText(input.candidate.dispatch_id)
        || 'unknown-dispatch';
}
function resolveContractRef(input) {
    return cleanText(input.outcome.contract_ref)
        || cleanText(input.candidate.contract_ref)
        || null;
}
function resolveTimestamp(input) {
    return cleanText(input.outcome.created_at)
        || cleanText(input.candidate.captured_at)
        || cleanText(input.contract?.created_at)
        || 'unknown-timestamp';
}
function computeAdrId(candidateId, artifactRef, outcomeId, decision) {
    const source = decision === 'PROMOTED'
        ? `${candidateId}|${artifactRef || 'missing-artifact'}`
        : `${candidateId}|${outcomeId}`;
    const hash = (0, crypto_1.createHash)('sha256').update(source).digest('hex').slice(0, 16);
    return `adr_v1_${hash}`;
}
function buildDeterministicAdrV1(input) {
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
exports.buildDeterministicAdrV1 = buildDeterministicAdrV1;
exports.renderDeterministicAdr = buildDeterministicAdrV1;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildResolvedOutcomeSummary = void 0;
function cleanText(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function parseJsonStringArray(value) {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
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
        if (parsed && typeof parsed === 'object') {
            return cleanText(parsed.summary) || cleanText(parsed.details) || content;
        }
    }
    catch {
        // fall through to raw content
    }
    return content;
}
function summarizeReason(input) {
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
function resolveAffectedFileRefs(input) {
    const fromArtifact = parseJsonStringArray(input.artifact?.extracted_file_refs_json || null);
    if (fromArtifact.length) {
        return fromArtifact;
    }
    return [];
}
function formatSummaryText(summary) {
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
function buildResolvedOutcomeSummary(input) {
    const rejectionReason = cleanText(input.outcome.rejection_reason)
        || cleanText(input.candidate.rejection_reason)
        || cleanText(input.candidate.gate_failure_reason);
    const affectedFileRefs = resolveAffectedFileRefs(input);
    const explanation = summarizeReason(input);
    const contractSummary = parseContractSummary(input.contract);
    const summary = {
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
exports.buildResolvedOutcomeSummary = buildResolvedOutcomeSummary;

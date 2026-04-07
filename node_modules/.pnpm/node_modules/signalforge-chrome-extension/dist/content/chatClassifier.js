function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}
function containsAny(lower, terms) {
    return terms.filter((term) => lower.includes(term));
}
function hasStructuredInstructionBlocks(text) {
    return (/```[\s\S]+```/.test(text)
        || /^\s*\d+\.\s+/m.test(text)
        || /^\s*[-*]\s+/m.test(text)
        || /\brequired deliverables\b/i.test(text)
        || /\bacceptance criteria\b/i.test(text));
}
function detectExecutionSignals(text) {
    const normalized = normalizeText(text);
    const lower = normalized.toLowerCase();
    const signals = [];
    if (normalized.length >= 360)
        signals.push('large_paste');
    if (/(\.ts\b|\.tsx\b|\.js\b|\.json\b|src\/|apps\/|packages\/|#L\d+)/i.test(normalized)) {
        signals.push('file_references');
    }
    if (/(what i changed|build status|files changed|implemented|fixed|refactor|ran|build passed|build failed|pnpm|npm run|apply_patch|diff|patch)/i.test(lower)) {
        signals.push('implementation_language');
    }
    if (/```[\s\S]+```/.test(normalized))
        signals.push('code_blocks');
    return signals;
}
export function classifyTurn(role, text) {
    const normalized = normalizeText(text);
    if (!normalized)
        return null;
    if (role === 'user') {
        const lower = normalized.toLowerCase();
        const directiveMatches = containsAny(lower, [
            'implement',
            'fix',
            'add',
            'refactor',
            'contract',
            'requirements',
        ]);
        const structured = hasStructuredInstructionBlocks(normalized);
        const executionSignals = detectExecutionSignals(normalized);
        if (executionSignals.includes('large_paste') && executionSignals.includes('file_references') && executionSignals.includes('implementation_language')) {
            return {
                classification: 'copilot_execution_narrative_pasted',
                signals: executionSignals,
                summaryReason: 'User turn matches deterministic execution narrative paste discriminator.',
            };
        }
        if ((directiveMatches.length > 0 || structured) && executionSignals.length === 0) {
            return {
                classification: 'contract_input',
                signals: [
                    ...(directiveMatches.length ? directiveMatches.map((m) => `directive:${m}`) : []),
                    ...(structured ? ['structured_instruction_block'] : []),
                ],
                summaryReason: 'User turn matches deterministic contract-input rule set.',
            };
        }
        return null;
    }
    const lower = normalized.toLowerCase();
    const verificationSignals = containsAny(lower, [
        'this aligns',
        'this violates',
        'this matches the contract',
        'missing requirement',
        'the code does',
        'this fix addresses',
        'correct',
        'validation',
        'gap',
        'issue',
    ]);
    if (verificationSignals.length > 0) {
        return {
            classification: 'chatgpt_verification_response',
            signals: verificationSignals.map((signal) => `verification:${signal}`),
            summaryReason: 'Assistant turn includes evaluative implementation language.',
        };
    }
    return null;
}

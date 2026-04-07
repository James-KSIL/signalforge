"use strict";
/**
 * SignalForge content bundle for MV3 classic content script execution.
 *
 * This file intentionally contains no imports/exports.
 */
const COPILOT_DISCRIMINATOR_MIN_LEN = 360;
const COPILOT_CANDIDATE_BUFFER_KEY = 'signalforge.copilotCandidateBuffer';
const COPILOT_CANDIDATE_BUFFER_LIMIT = 20;
const DISPATCH_TRIGGERS = [
    'dispatch',
    'send it',
    'execute',
    'run this',
    'ship it'
];
function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}
function computeTextHash(text) {
    const normalized = normalizeText(text).toLowerCase();
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i += 1) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `fnv1a_${(hash >>> 0).toString(16)}`;
}
function tokenOverlapRatio(a, b) {
    const aTokens = new Set(normalizeText(a).toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean));
    const bTokens = new Set(normalizeText(b).toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean));
    if (!aTokens.size || !bTokens.size)
        return 0;
    let intersection = 0;
    for (const token of aTokens.values()) {
        if (bTokens.has(token))
            intersection += 1;
    }
    return intersection / Math.max(aTokens.size, bTokens.size);
}
function containsAny(lower, terms) {
    return terms.filter((term) => lower.includes(term));
}
function hasStructuredInstructionBlocks(text) {
    return (/```[\s\S]+```/.test(text)
        || /^\s*\d+\.\s+/m.test(text)
        || /^\s*[-*]\s+/m.test(text)
        || /\bacceptance criteria\b/i.test(text)
        || /\brequired deliverables\b/i.test(text));
}
function detectExecutionSignals(text) {
    const normalized = normalizeText(text);
    const lower = normalized.toLowerCase();
    const signals = [];
    if (normalized.length >= COPILOT_DISCRIMINATOR_MIN_LEN)
        signals.push('large_paste');
    if (/(\.ts\b|\.tsx\b|\.js\b|\.json\b|src\/|apps\/|packages\/|#L\d+)/i.test(normalized)) {
        signals.push('file_references');
    }
    if (/(what i changed|build status|files changed|implemented|fixed|refactor|ran terminal command|pnpm|npm run|diff|patch|build passed|build failed)/i.test(lower)) {
        signals.push('implementation_language');
    }
    if (/```[\s\S]+```/.test(normalized))
        signals.push('code_blocks');
    return signals;
}
function classifyTurnDeterministic(role, text) {
    const normalized = normalizeText(text);
    if (!normalized)
        return null;
    if (role === 'user') {
        const lower = normalized.toLowerCase();
        const directiveMatches = containsAny(lower, ['implement', 'fix', 'add', 'refactor', 'contract', 'requirements']);
        const structured = hasStructuredInstructionBlocks(normalized);
        const executionSignals = detectExecutionSignals(normalized);
        if (executionSignals.includes('large_paste') && executionSignals.includes('file_references') && executionSignals.includes('implementation_language')) {
            return {
                classification: 'copilot_execution_narrative_pasted',
                signals: executionSignals,
                summaryReason: 'User turn matches deterministic execution narrative discriminator.',
            };
        }
        if ((directiveMatches.length > 0 || structured) && executionSignals.length === 0) {
            return {
                classification: 'contract_input',
                signals: [
                    ...(directiveMatches.length ? directiveMatches.map((m) => `directive:${m}`) : []),
                    ...(structured ? ['structured_instruction_block'] : []),
                ],
                summaryReason: 'User turn matches deterministic contract-input signals.',
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
        'addresses',
    ]);
    if (verificationSignals.length === 0)
        return null;
    return {
        classification: 'chatgpt_verification_response',
        signals: verificationSignals.map((signal) => `verification:${signal}`),
        summaryReason: 'Assistant turn includes evaluative implementation language.',
    };
}
function simpleId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
    return new Date().toISOString();
}
function detectDispatchTrigger(text) {
    const lower = text.toLowerCase();
    for (const t of DISPATCH_TRIGGERS) {
        if (lower.includes(t))
            return t;
    }
    return null;
}
function extractTurnsFromPage() {
    const nodes = Array.from(document.querySelectorAll('div'));
    const results = [];
    nodes.forEach((n) => {
        const text = n.innerText && n.innerText.trim();
        if (!text)
            return;
        const role = n.getAttribute('data-role');
        if (role === 'user' || role === 'assistant') {
            results.push({ role, text });
            return;
        }
        const cls = n.className || '';
        if (/user/i.test(cls))
            results.push({ role: 'user', text });
        else if (/assistant|bot|assistant-message/i.test(cls))
            results.push({ role: 'assistant', text });
    });
    return results;
}
class ChatObserver {
    constructor(config = {}) {
        this.turnIndexCounter = 0;
        this.emittedSignatures = new Set();
        this.config = config;
        this.threadId = this.computeThreadId();
        this.init();
    }
    init() {
        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', () => this.observeConversations());
            return;
        }
        this.observeConversations();
    }
    computeThreadId() {
        try {
            const path = location.pathname || 'unknown';
            return `thread:${path}`;
        }
        catch {
            return `session:${simpleId()}`;
        }
    }
    sendEvent(e) {
        try {
            chrome.runtime.sendMessage(e);
        }
        catch (err) {
            if (this.config.debug) {
                console.warn('[ChatObserver] sendEvent error', err);
            }
        }
    }
    signatureFor(turnIndex, role, content) {
        const snippet = content.slice(0, 140);
        return `${this.threadId}|${turnIndex}|${role}|${snippet}`;
    }
    readActiveBindingContext() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['active_project_id', 'active_session_id', 'active_dispatch_id'], (result) => {
                resolve({
                    project_id: String(result.active_project_id || 'unbound_project'),
                    session_id: String(result.active_session_id || 'session_unbound'),
                    dispatch_id: result.active_dispatch_id ? String(result.active_dispatch_id) : null,
                });
            });
        });
    }
    readCandidateBuffer() {
        return new Promise((resolve) => {
            chrome.storage.local.get([COPILOT_CANDIDATE_BUFFER_KEY], (result) => {
                const buffer = Array.isArray(result[COPILOT_CANDIDATE_BUFFER_KEY])
                    ? result[COPILOT_CANDIDATE_BUFFER_KEY]
                    : [];
                resolve(buffer);
            });
        });
    }
    computeSignature(text, capturedAt) {
        const normalized = normalizeText(text);
        return {
            text_hash: computeTextHash(normalized),
            normalized_length: normalized.length,
            excerpt: normalized.slice(0, 240),
            captured_at: capturedAt,
        };
    }
    resolveBufferDedupMatch(signature, buffer, context) {
        const capturedAtMs = new Date(signature.captured_at).getTime();
        for (const candidate of buffer) {
            if (candidate.project_id !== context.project_id)
                continue;
            if (context.session_id !== 'session_unbound' && candidate.session_id !== context.session_id)
                continue;
            const normalizedCandidate = normalizeText(candidate.raw_text);
            const candidateHash = computeTextHash(normalizedCandidate);
            if (candidateHash === signature.text_hash) {
                return {
                    candidate_id: candidate.candidate_id,
                    summary_reason: 'dedup_chrome_buffer_hash_match',
                };
            }
            const candidateCapturedMs = new Date(candidate.captured_at).getTime();
            const withinWindow = Number.isFinite(candidateCapturedMs)
                && Number.isFinite(capturedAtMs)
                && Math.abs(candidateCapturedMs - capturedAtMs) <= 10 * 60 * 1000;
            const lengthClose = Math.abs(normalizedCandidate.length - signature.normalized_length) <= 24;
            const overlap = tokenOverlapRatio(signature.excerpt, normalizedCandidate);
            if (withinWindow && lengthClose && overlap >= 0.72) {
                return {
                    candidate_id: candidate.candidate_id,
                    summary_reason: 'dedup_chrome_buffer_overlap_match',
                };
            }
        }
        return null;
    }
    lookupNativeDedupMatch(signature, context) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'lookup_copilot_candidate',
                payload: {
                    project_id: context.project_id,
                    session_id: context.session_id,
                    ...signature,
                },
            }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve(null);
                    return;
                }
                const candidate = response?.response;
                if (response?.ok && candidate?.type === 'copilot_candidate_lookup' && candidate?.found && candidate?.candidate_id) {
                    resolve({
                        candidate_id: String(candidate.candidate_id),
                        summary_reason: String(candidate.summary_reason || 'dedup_native_lookup_match'),
                    });
                    return;
                }
                resolve(null);
            });
        });
    }
    async classifyAndEmitTurn(role, text, turnIndex) {
        const classified = classifyTurnDeterministic(role, text);
        if (!classified)
            return;
        const context = await this.readActiveBindingContext();
        let correlatedCandidateId = null;
        let summaryReason = classified.summaryReason;
        const signals = [...classified.signals];
        if (classified.classification === 'copilot_execution_narrative_pasted') {
            const signature = this.computeSignature(text, nowIso());
            const buffer = await this.readCandidateBuffer();
            const chromeMatch = this.resolveBufferDedupMatch(signature, buffer, context);
            if (chromeMatch) {
                correlatedCandidateId = chromeMatch.candidate_id;
                summaryReason = chromeMatch.summary_reason;
                signals.push('dedup:chrome_buffer');
            }
            else {
                const nativeMatch = await this.lookupNativeDedupMatch(signature, context);
                if (nativeMatch) {
                    correlatedCandidateId = nativeMatch.candidate_id;
                    summaryReason = nativeMatch.summary_reason;
                    signals.push('dedup:native_lookup');
                }
                else {
                    summaryReason = 'dedup_no_match_clipboard_pipeline_only';
                    signals.push('dedup:no_match');
                }
            }
        }
        const classifiedEvent = {
            type: 'chatgpt_turn_classified',
            eventId: simpleId('evt'),
            chatThreadId: this.threadId,
            sourceUrl: location.href,
            turnIndex,
            role,
            content: text,
            classification: classified.classification,
            project_id: context.project_id,
            session_id: context.session_id,
            dispatch_id: context.dispatch_id,
            timestamp: nowIso(),
            classification_signals: signals,
            summary_reason: summaryReason,
            correlated_candidate_id: correlatedCandidateId,
        };
        this.sendEvent({ kind: 'browser_event', payload: classifiedEvent });
    }
    observeConversations() {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                const added = Array.from(m.addedNodes || []).filter((n) => n.nodeType === 1);
                for (const node of added) {
                    const el = node;
                    const text = el.innerText && el.innerText.trim();
                    if (!text)
                        continue;
                    const roleAttr = el.getAttribute('data-role');
                    const role = roleAttr === 'user'
                        ? 'user'
                        : roleAttr === 'assistant'
                            ? 'assistant'
                            : /user/i.test(el.className)
                                ? 'user'
                                : 'assistant';
                    const turnIndex = ++this.turnIndexCounter;
                    const sig = this.signatureFor(turnIndex, role, text);
                    if (this.emittedSignatures.has(sig))
                        continue;
                    this.emittedSignatures.add(sig);
                    const event = {
                        type: 'chat_turn_completed',
                        eventId: simpleId('evt'),
                        chatThreadId: this.threadId,
                        sourceUrl: location.href,
                        turnIndex,
                        role,
                        content: text,
                        createdAt: nowIso(),
                    };
                    this.sendEvent({ kind: 'browser_event', payload: event });
                    void this.classifyAndEmitTurn(role, text, turnIndex);
                    if (role === 'user') {
                        const matched = detectDispatchTrigger(text);
                        if (matched) {
                            const det = {
                                type: 'dispatch_phrase_detected',
                                eventId: simpleId('evt'),
                                chatThreadId: this.threadId,
                                sourceUrl: location.href,
                                turnIndex,
                                content: text,
                                matchedTrigger: matched,
                                createdAt: nowIso(),
                            };
                            this.sendEvent({ kind: 'browser_event', payload: det });
                            chrome.runtime.sendMessage({ type: 'awaiting_dispatch', chatThreadId: this.threadId });
                        }
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        if (this.config.debug) {
            console.log('[ChatObserver] observing conversation mutations', {
                threadId: this.threadId,
                initialTurns: extractTurnsFromPage().length,
            });
        }
    }
}
class CopyInterceptor {
    constructor(config = {}) {
        this.chatGPTOrigins = [
            'https://chatgpt.com',
            'https://www.chatgpt.com',
            'https://chat.openai.com',
        ];
        this.listeningForCopy = false;
        this.lastCopySignature = null;
        this.implementationPhrases = [
            'what i changed',
            'build status',
            'files changed',
            'implemented',
            'fixed',
            'rebuilt',
            'exact files changed',
            'ran terminal command',
        ];
        this.config = config;
        this.init();
    }
    init() {
        if (!this.isOnChatGPT()) {
            this.log('Not on ChatGPT - interceptor inactive');
            return;
        }
        this.log('CopyInterceptor: initializing on ChatGPT');
        this.setupCopyListener();
        this.setupCanvasClickListener();
    }
    setupCopyListener() {
        document.addEventListener('copy', (event) => {
            this.handleCopyEvent(event, 'manual');
        });
        this.listeningForCopy = true;
        this.log('Copy listener registered');
    }
    setupCanvasClickListener() {
        document.addEventListener('click', (event) => {
            const rawTarget = event.target;
            const button = rawTarget.closest('button, [role="button"]');
            this.logCanvasClickCandidate(rawTarget, button);
            if (button && this.isCanvasCopyButton(button, rawTarget)) {
                this.log('Detected canvas copy button');
                this.handleCopyButton(button, 'canvas');
                return;
            }
            if (button && this.isStandardResponseCopyButton(button)) {
                this.log('Detected standard response copy button');
                this.handleCopyButton(button, 'standard');
            }
        });
        this.log('Canvas copy button listener registered');
    }
    handleCopyEvent(event, selectionType) {
        const clipboardText = event.clipboardData?.getData('text/plain') || '';
        const selectionText = window.getSelection?.()?.toString() || '';
        const copiedText = clipboardText.trim().length > 0 ? clipboardText : selectionText;
        if (clipboardText.trim().length > 0) {
            this.log('Manual copy used clipboardData');
        }
        else if (selectionText.trim().length > 0) {
            this.log('Manual copy used selection fallback');
        }
        if (!copiedText || copiedText.trim().length === 0) {
            this.log('Copy event: no text content');
            return;
        }
        if (this.isDuplicateCopy(copiedText, selectionType, window.location.href)) {
            this.log('Duplicate copy event suppressed');
            return;
        }
        this.log(`Manual copy extracted text preview: ${copiedText.substring(0, 50)}...`);
        const chatId = this.extractChatId();
        if (!chatId) {
            this.log('Warning: Could not extract chat ID');
            return;
        }
        void this.evaluateAndStageCopilotCandidate(copiedText, {
            chatId,
            selectionType,
            sourceUrl: window.location.href,
        });
        this.sendCopyBindingRequest({
            chat_id: chatId,
            copied_text: copiedText,
            selection_type: selectionType,
            source_url: window.location.href,
            created_at: new Date().toISOString(),
        });
    }
    handleCopyButton(buttonElement, surface) {
        const branchLabel = surface === 'canvas' ? 'canvas' : 'standard';
        this.log(`${branchLabel} copy button clicked`);
        this.logCopyButtonAncestorChain(buttonElement, branchLabel);
        const resolved = surface === 'canvas'
            ? this.resolveCanvasCopyContent(buttonElement)
            : this.resolveStandardResponseCopyContent(buttonElement);
        if (!resolved) {
            this.log(`Warning: Could not resolve ${branchLabel} content container for copy button`);
            return;
        }
        if (surface === 'canvas') {
            this.log(`Resolved canvas wrapper: <${resolved.wrapper.tagName.toLowerCase()}> ${resolved.wrapper.className || '[no-class]'}`);
            this.log(`Resolved canvas content container: <${resolved.contentNode.tagName.toLowerCase()}> ${resolved.contentNode.className || '[no-class]'}`);
        }
        else {
            this.log(`Resolved standard turn wrapper: <${resolved.wrapper.tagName.toLowerCase()}> ${resolved.wrapper.className || '[no-class]'}`);
            this.log(`Resolved standard content container: <${resolved.contentNode.tagName.toLowerCase()}> ${resolved.contentNode.className || '[no-class]'}`);
        }
        const copiedText = this.extractTextFromMessageBlock(resolved.contentNode);
        if (!copiedText || copiedText.trim().length === 0) {
            this.log(`${branchLabel} copy: no text extracted from resolved content container`);
            return;
        }
        if (this.isDuplicateCopy(copiedText, 'canvas', window.location.href)) {
            this.log(`${branchLabel} copy suppressed by dedupe`);
            return;
        }
        this.log(`${branchLabel} copy: ${copiedText.substring(0, 50)}...`);
        const chatId = this.extractChatId();
        if (!chatId) {
            this.log('Warning: Could not extract chat ID');
            return;
        }
        void this.evaluateAndStageCopilotCandidate(copiedText, {
            chatId,
            selectionType: 'canvas',
            sourceUrl: window.location.href,
        });
        this.sendCopyBindingRequest({
            chat_id: chatId,
            copied_text: copiedText,
            selection_type: 'canvas',
            source_url: window.location.href,
            created_at: new Date().toISOString(),
        });
    }
    async evaluateAndStageCopilotCandidate(rawText, context) {
        const signalFlags = this.computeCopilotSignalFlags(rawText);
        if (!signalFlags.threshold_passed) {
            this.log('Discriminator rejected clipboard candidate');
            return;
        }
        const storage = await this.getStorageSnapshot();
        const candidate = {
            candidate_id: simpleId('cand'),
            project_id: storage.activeProjectId || 'unbound_project',
            session_id: storage.activeSessionId || 'session_unbound',
            dispatch_id: storage.activeDispatchId,
            captured_at: nowIso(),
            source: 'clipboard',
            raw_text: rawText,
            signal_flags: signalFlags,
            capture_context: {
                source_url: context.sourceUrl,
                selection_type: context.selectionType,
                chat_id: context.chatId,
            },
        };
        await this.stageCandidateInBuffer(candidate);
        this.emitCopilotCandidateCaptured(candidate);
    }
    computeCopilotSignalFlags(text) {
        const normalized = text.replace(/\s+/g, ' ').trim();
        const lower = normalized.toLowerCase();
        const extractedRefs = Array.from(new Set((normalized.match(/(?:^|[^A-Za-z0-9_])((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]+)(?=$|[^A-Za-z0-9_])/g) || [])
            .map((m) => m.replace(/^[^A-Za-z0-9_.-]*/, '').trim())
            .filter(Boolean)));
        const highCompletionMarker = /(?:^|\n)\s{0,3}(?:#{1,6}\s*)?(Implementation Complete|Major Implementation Complete|Final Outcome|Outcome|Result)\b|##\s*Implementation\b/i.test(text);
        const highFileListingBlock = /\b(Created|Modified|Deleted)\s*:\s*[^\n]*(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]+/i.test(text);
        const highCommandResult = /(->\s*(PASS|FAIL)\b|\bPASS\b|\bFAILED\b|\bSuccess\b|\bExit\s+code\s*:?\s*0\b)/i.test(text);
        const highNestedRefs = extractedRefs.filter((ref) => ref.includes('/')).length >= 2;
        const mediumSectionHeader = /\b(Files Changed|Change Inventory|Validation|Validation Matrix|Build Status|Detailed Changes|Scope|What Changed|File-by-File Highlights)\b/i.test(text);
        const mediumValidationHeader = /\b(Validation|Validation Matrix)\b/i.test(text);
        const mediumKnownBuildCommand = /\b(pnpm|pytest|python\s+-m\s+unittest|npm\s+run|cargo\s+build|go\s+build)\b/i.test(text);
        const mediumAnyExtractedRef = extractedRefs.length >= 1;
        const lowProseEmbeddedPath = /(?:^|[^A-Za-z0-9_])(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]+(?=$|[^A-Za-z0-9_])/i.test(text);
        const lowHeadingFamily = /(?:^|\n)\s{0,3}(?:#{1,6}\s*)?[^\n]*(Implementation|Validation|Outcome|Result)[^\n]*/i.test(text);
        const lowVeryLongText = normalized.length > 2000;
        const minLengthOk = normalized.length >= COPILOT_DISCRIMINATOR_MIN_LEN;
        const implementationLanguageOk = this.implementationPhrases.some((phrase) => lower.includes(phrase));
        const technicalScore = (highFileListingBlock ? 3 : 0)
            + (highNestedRefs ? 3 : 0)
            + (mediumSectionHeader ? 2 : 0)
            + (mediumAnyExtractedRef ? 2 : 0)
            + (lowProseEmbeddedPath ? 1 : 0)
            + (lowHeadingFamily ? 1 : 0)
            + (lowVeryLongText ? 1 : 0);
        const buildScore = (highCommandResult ? 3 : 0)
            + (mediumValidationHeader ? 2 : 0)
            + (mediumKnownBuildCommand ? 2 : 0)
            + (lowHeadingFamily ? 1 : 0)
            + (lowVeryLongText ? 1 : 0);
        const completionScore = (highCompletionMarker ? 3 : 0)
            + (lowHeadingFamily ? 1 : 0)
            + (lowVeryLongText ? 1 : 0);
        const technicalSupportingMarkers = [mediumSectionHeader, mediumAnyExtractedRef, lowProseEmbeddedPath].filter(Boolean).length;
        const technicalHasStrong = highFileListingBlock || highNestedRefs;
        const technicalStructureOk = ((highFileListingBlock || (mediumAnyExtractedRef && mediumSectionHeader))
            && technicalScore >= 3
            && (technicalHasStrong || technicalSupportingMarkers >= 2));
        const buildDiagnosticOk = (highCommandResult || mediumKnownBuildCommand || mediumValidationHeader) && buildScore >= 3;
        const completionMarkerOk = highCompletionMarker && completionScore >= 3;
        const totalScore = technicalScore + buildScore + completionScore;
        const structuralIntegrityOk = totalScore >= 7;
        const matchedSignals = [];
        if (minLengthOk)
            matchedSignals.push('length_threshold');
        if (technicalStructureOk)
            matchedSignals.push('technical_structure');
        if (implementationLanguageOk)
            matchedSignals.push('implementation_language');
        if (buildDiagnosticOk)
            matchedSignals.push('build_diagnostic');
        if (completionMarkerOk)
            matchedSignals.push('completion_marker');
        if (structuralIntegrityOk)
            matchedSignals.push('structural_integrity');
        const thresholdPassed = minLengthOk && (technicalStructureOk || implementationLanguageOk) && (implementationLanguageOk || buildDiagnosticOk);
        return {
            min_length_ok: minLengthOk,
            technical_structure_ok: technicalStructureOk,
            implementation_language_ok: implementationLanguageOk,
            build_diagnostic_ok: buildDiagnosticOk,
            completion_marker_ok: completionMarkerOk,
            structural_integrity_ok: structuralIntegrityOk,
            signal_total_score: totalScore,
            technical_signal_score: technicalScore,
            build_signal_score: buildScore,
            completion_signal_score: completionScore,
            matched_signals: matchedSignals,
            threshold_passed: thresholdPassed,
            text_length: normalized.length,
            minimum_length: COPILOT_DISCRIMINATOR_MIN_LEN,
        };
    }
    getStorageSnapshot() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['active_project_id', 'active_session_id', 'active_dispatch_id'], (result) => {
                resolve({
                    activeProjectId: typeof result.active_project_id === 'string' ? result.active_project_id : null,
                    activeSessionId: typeof result.active_session_id === 'string' ? result.active_session_id : null,
                    activeDispatchId: typeof result.active_dispatch_id === 'string' ? result.active_dispatch_id : null,
                });
            });
        });
    }
    stageCandidateInBuffer(candidate) {
        return new Promise((resolve) => {
            chrome.storage.local.get([COPILOT_CANDIDATE_BUFFER_KEY], (result) => {
                const existing = Array.isArray(result[COPILOT_CANDIDATE_BUFFER_KEY])
                    ? result[COPILOT_CANDIDATE_BUFFER_KEY]
                    : [];
                const next = [candidate, ...existing].slice(0, COPILOT_CANDIDATE_BUFFER_LIMIT);
                chrome.storage.local.set({ [COPILOT_CANDIDATE_BUFFER_KEY]: next }, () => resolve());
            });
        });
    }
    emitCopilotCandidateCaptured(candidate) {
        chrome.runtime.sendMessage({
            type: 'copilot_candidate_captured',
            payload: candidate,
        }, (_response) => {
            if (chrome.runtime.lastError) {
                this.log(`Error emitting copilot candidate: ${chrome.runtime.lastError.message}`);
                return;
            }
            this.log(`Staged copilot candidate ${candidate.candidate_id}`);
        });
    }
    sendCopyBindingRequest(event) {
        const summary = event.copied_text
            .slice(0, 120)
            .replace(/\s+/g, ' ')
            .trim();
        chrome.storage.local.get(['active_project_id'], (result) => {
            const projectId = result.active_project_id ?? null;
            if (!projectId) {
                this.log('No active project pinned in VS Code; copy event not dispatched');
                return;
            }
            chrome.runtime.sendMessage({
                type: 'copy_binding_requested',
                payload: {
                    ...event,
                    summary,
                    project_id: projectId,
                },
            }, (_response) => {
                if (chrome.runtime.lastError) {
                    this.log(`Error sending message: ${chrome.runtime.lastError.message}`);
                    return;
                }
                this.log('Copy binding request sent to background');
            });
        });
    }
    isDuplicateCopy(text, selectionType, sourceUrl) {
        const normalized = normalizeText(text).slice(0, 280);
        if (!normalized)
            return true;
        const key = `${selectionType}|${sourceUrl}|${computeTextHash(normalized)}`;
        const now = Date.now();
        const last = this.lastCopySignature;
        this.lastCopySignature = { key, ts: now };
        if (!last)
            return false;
        return last.key === key && now - last.ts < 1500;
    }
    extractChatId() {
        const urlMatch = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
        if (urlMatch && urlMatch[1]) {
            return urlMatch[1];
        }
        const pageState = window.__INITIAL_STATE__;
        if (pageState?.chatId) {
            return pageState.chatId;
        }
        return null;
    }
    isStandardResponseCopyButton(button) {
        const dataTestId = button.getAttribute('data-testid');
        const ariaLabel = button.getAttribute('aria-label');
        return dataTestId === 'copy-turn-action-button' && ariaLabel === 'Copy response';
    }
    isCanvasCopyButton(button, rawTarget) {
        if (this.isStandardResponseCopyButton(button)) {
            return false;
        }
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const title = (button.getAttribute('title') || '').toLowerCase();
        const text = (button.textContent || '').trim().toLowerCase();
        const rawText = (rawTarget.textContent || '').trim().toLowerCase();
        const looksLikeCopy = ariaLabel.includes('copy')
            || title.includes('copy')
            || text === 'copy'
            || rawText.includes('copy');
        return looksLikeCopy;
    }
    logCanvasClickCandidate(rawTarget, button) {
        const clickedTag = rawTarget.tagName.toLowerCase();
        const buttonTag = button ? button.tagName.toLowerCase() : '-';
        const buttonAriaLabel = button?.getAttribute('aria-label') || '-';
        const buttonDataTestId = button?.getAttribute('data-testid') || '-';
        const buttonClassName = button?.className || '-';
        this.log(`Canvas click candidate: clicked tag=${clickedTag} nearest button tag=${buttonTag} nearest button aria-label=${buttonAriaLabel} nearest button data-testid=${buttonDataTestId} nearest button className=${buttonClassName}`);
    }
    resolveStandardResponseCopyContent(buttonElement) {
        const actionsGroup = buttonElement.closest('div[aria-label="Response actions"][role="group"]');
        if (!actionsGroup) {
            this.log('Warning: standard copy button click was not inside response actions group');
            return null;
        }
        let current = actionsGroup;
        let depth = 0;
        while (current && depth < 8) {
            const assistantScope = current.matches('[data-message-author-role="assistant"]')
                ? current
                : current.querySelector('[data-message-author-role="assistant"]');
            const assistantRoot = assistantScope;
            if (assistantRoot) {
                const contentNode = this.findBestContentCandidate(assistantRoot, actionsGroup, 20);
                if (contentNode) {
                    return { wrapper: current, contentNode };
                }
            }
            const siblingFallback = this.findSiblingContentNearActions(actionsGroup, 20);
            if (siblingFallback && current.contains(siblingFallback)) {
                return { wrapper: current, contentNode: siblingFallback };
            }
            current = current.parentElement;
            depth += 1;
        }
        return null;
    }
    resolveCanvasCopyContent(buttonElement) {
        const canvasWrapper = this.findCanvasWrapper(buttonElement);
        const scopeRoot = canvasWrapper ?? document.body;
        const actionsGroup = buttonElement.closest('div[aria-label="Response actions"][role="group"]');
        if (actionsGroup) {
            const siblingContent = this.findSiblingContentNearActions(actionsGroup, 20);
            if (siblingContent) {
                return { wrapper: scopeRoot, contentNode: siblingContent };
            }
        }
        let current = buttonElement.parentElement;
        for (let depth = 0; depth < 10 && current; depth += 1) {
            const text = (current.textContent || '').trim();
            if (text.length > 40 && !current.querySelector('input, textarea')) {
                return { wrapper: scopeRoot, contentNode: current };
            }
            current = current.parentElement;
        }
        const scopedContent = this.findBestContentCandidate(scopeRoot, actionsGroup, 20);
        if (scopedContent) {
            return { wrapper: scopeRoot, contentNode: scopedContent };
        }
        this.log('Warning: Could not resolve canvas content - fallback exhausted');
        return null;
    }
    findCanvasWrapper(buttonElement) {
        let current = buttonElement;
        for (let depth = 0; depth < 10 && current; depth += 1) {
            const signature = [
                current.getAttribute('data-testid') || '',
                current.getAttribute('aria-label') || '',
                current.id || '',
                current.className || '',
            ].join(' ').toLowerCase();
            if (signature.includes('canvas')) {
                return current;
            }
            current = current.parentElement;
        }
        return buttonElement.closest('[role="dialog"]');
    }
    findSiblingContentNearActions(actionsGroup, minTextLength) {
        const actionHost = actionsGroup.parentElement;
        if (!actionHost) {
            return null;
        }
        let sibling = actionHost.previousElementSibling;
        while (sibling) {
            const siblingElement = sibling;
            if (this.isUsableContentNode(siblingElement, actionsGroup, minTextLength)) {
                return siblingElement;
            }
            sibling = sibling.previousElementSibling;
        }
        return null;
    }
    findBestContentCandidate(scopeRoot, actionsGroup, minTextLength) {
        const selectors = [
            '[data-message-content]',
            '.markdown',
            '[class*="markdown"]',
            '.prose',
            '[class*="prose"]',
            'main',
            'section',
            'article',
            'div',
        ];
        const candidates = Array.from(scopeRoot.querySelectorAll(selectors.join(', ')));
        let best = null;
        let bestLen = 0;
        for (const candidate of candidates) {
            if (!this.isUsableContentNode(candidate, actionsGroup, minTextLength)) {
                continue;
            }
            const textLen = (this.extractTextFromMessageBlock(candidate) || '').length;
            if (textLen > bestLen) {
                best = candidate;
                bestLen = textLen;
            }
        }
        return best;
    }
    isUsableContentNode(candidate, actionsGroup, minTextLength) {
        if (actionsGroup) {
            if (candidate === actionsGroup
                || candidate.contains(actionsGroup)
                || actionsGroup.contains(candidate)) {
                return false;
            }
            if (candidate.closest('div[aria-label="Response actions"][role="group"]')) {
                return false;
            }
        }
        if (candidate.querySelector('button')) {
            const buttonCount = candidate.querySelectorAll('button').length;
            const textLen = (candidate.textContent || '').trim().length;
            if (buttonCount > 0 && textLen < 24) {
                return false;
            }
        }
        const extracted = this.extractTextFromMessageBlock(candidate);
        if (!extracted || extracted.length < minTextLength) {
            return false;
        }
        return true;
    }
    logCopyButtonAncestorChain(buttonElement, branchLabel) {
        if (!this.config.debug) {
            return;
        }
        const lines = [];
        let current = buttonElement;
        for (let i = 0; i < 8 && current; i += 1) {
            lines.push(`${i}: <${current.tagName.toLowerCase()}> data-testid=${current.getAttribute('data-testid') || '-'} aria-label=${current.getAttribute('aria-label') || '-'} role=${current.getAttribute('role') || '-'} class=${current.className || '-'}`);
            current = current.parentElement;
        }
        this.log(`${branchLabel} copy button ancestor chain\n${lines.join('\n')}`);
    }
    extractTextFromMessageBlock(messageBlock) {
        const text = messageBlock.textContent || '';
        return text
            .replace(/\s*copy\s*/gi, '')
            .replace(/\s*edit\s*/gi, '')
            .trim();
    }
    isOnChatGPT() {
        const origin = window.location.origin;
        return this.chatGPTOrigins.some((allowedOrigin) => origin.includes(allowedOrigin));
    }
    log(message) {
        if (this.config.debug) {
            console.log(`[CopyInterceptor] ${message}`);
        }
    }
}
new ChatObserver({ debug: true });
new CopyInterceptor({ debug: true });

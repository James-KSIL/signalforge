/**
 * SignalForge content bundle for MV3 classic content script execution.
 *
 * This file intentionally contains no imports/exports.
 */

type Outgoing = any;
type ChatRole = 'user' | 'assistant';

interface ExtractedTurn {
  role: ChatRole;
  text: string;
}

interface ChatObserverConfig {
  debug?: boolean;
}

interface CopyInterceptorConfig {
  debug?: boolean;
}

type CopilotSignalFlags = {
  min_length_ok: boolean;
  technical_structure_ok: boolean;
  implementation_language_ok: boolean;
  build_diagnostic_ok: boolean;
  completion_marker_ok: boolean;
  structural_integrity_ok: boolean;
  signal_total_score: number;
  technical_signal_score: number;
  build_signal_score: number;
  completion_signal_score: number;
  matched_signals: string[];
  threshold_passed: boolean;
  text_length: number;
  minimum_length: number;
};

type CopilotClipboardCandidate = {
  candidate_id: string;
  project_id: string;
  session_id: string;
  dispatch_id: string | null;
  captured_at: string;
  source: 'clipboard';
  raw_text: string;
  signal_flags: CopilotSignalFlags;
  capture_context: {
    source_url: string;
    selection_type: 'manual' | 'canvas';
    chat_id: string;
  };
};

type ChatEvidenceClassification =
  | 'contract_input'
  | 'chatgpt_verification_response'
  | 'copilot_execution_narrative_pasted';

type ClassificationResult = {
  classification: ChatEvidenceClassification;
  signals: string[];
  summaryReason: string;
};

type CopilotSignature = {
  text_hash: string;
  normalized_length: number;
  excerpt: string;
  captured_at: string;
};

type DedupMatch = {
  candidate_id: string;
  summary_reason: string;
};

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

function normalizeText(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function computeTextHash(text: string): string {
  const normalized = normalizeText(text).toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}`;
}

function tokenOverlapRatio(a: string, b: string): number {
  const aTokens = new Set(normalizeText(a).toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean));
  const bTokens = new Set(normalizeText(b).toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let intersection = 0;
  for (const token of aTokens.values()) {
    if (bTokens.has(token)) intersection += 1;
  }
  return intersection / Math.max(aTokens.size, bTokens.size);
}

function containsAny(lower: string, terms: string[]): string[] {
  return terms.filter((term) => lower.includes(term));
}

function hasStructuredInstructionBlocks(text: string): boolean {
  return (
    /```[\s\S]+```/.test(text)
    || /^\s*\d+\.\s+/m.test(text)
    || /^\s*[-*]\s+/m.test(text)
    || /\bacceptance criteria\b/i.test(text)
    || /\brequired deliverables\b/i.test(text)
  );
}

function detectExecutionSignals(text: string): string[] {
  const normalized = normalizeText(text);
  const lower = normalized.toLowerCase();
  const signals: string[] = [];

  if (normalized.length >= COPILOT_DISCRIMINATOR_MIN_LEN) signals.push('large_paste');
  if (/(\.ts\b|\.tsx\b|\.js\b|\.json\b|src\/|apps\/|packages\/|#L\d+)/i.test(normalized)) {
    signals.push('file_references');
  }
  if (/(what i changed|build status|files changed|implemented|fixed|refactor|ran terminal command|pnpm|npm run|diff|patch|build passed|build failed)/i.test(lower)) {
    signals.push('implementation_language');
  }
  if (/```[\s\S]+```/.test(normalized)) signals.push('code_blocks');

  return signals;
}

function classifyTurnDeterministic(role: ChatRole, text: string): ClassificationResult | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;

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

  if (verificationSignals.length === 0) return null;

  return {
    classification: 'chatgpt_verification_response',
    signals: verificationSignals.map((signal) => `verification:${signal}`),
    summaryReason: 'Assistant turn includes evaluative implementation language.',
  };
}

function simpleId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function detectDispatchTrigger(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of DISPATCH_TRIGGERS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

function extractTurnsFromPage(): ExtractedTurn[] {
  const nodes = Array.from(document.querySelectorAll('div')) as HTMLElement[];
  const results: ExtractedTurn[] = [];

  nodes.forEach((n) => {
    const text = n.innerText && n.innerText.trim();
    if (!text) return;

    const role = n.getAttribute('data-role') as ChatRole | null;
    if (role === 'user' || role === 'assistant') {
      results.push({ role, text });
      return;
    }

    const cls = n.className || '';
    if (/user/i.test(cls)) results.push({ role: 'user', text });
    else if (/assistant|bot|assistant-message/i.test(cls)) results.push({ role: 'assistant', text });
  });

  return results;
}

class ChatObserver {
  private readonly config: ChatObserverConfig;
  private readonly threadId: string;
  private turnIndexCounter = 0;
  private readonly emittedSignatures = new Set<string>();

  constructor(config: ChatObserverConfig = {}) {
    this.config = config;
    this.threadId = this.computeThreadId();
    this.init();
  }

  private init(): void {
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', () => this.observeConversations());
      return;
    }
    this.observeConversations();
  }

  private computeThreadId(): string {
    try {
      const path = location.pathname || 'unknown';
      return `thread:${path}`;
    } catch {
      return `session:${simpleId()}`;
    }
  }

  private sendEvent(e: Outgoing): void {
    try {
      chrome.runtime.sendMessage(e);
    } catch (err) {
      if (this.config.debug) {
        console.warn('[ChatObserver] sendEvent error', err);
      }
    }
  }

  private signatureFor(turnIndex: number, role: string, content: string): string {
    const snippet = content.slice(0, 140);
    return `${this.threadId}|${turnIndex}|${role}|${snippet}`;
  }

  private readActiveBindingContext(): Promise<{ project_id: string; session_id: string; dispatch_id: string | null }> {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['active_project_id', 'active_session_id', 'active_dispatch_id'],
        (result) => {
          resolve({
            project_id: String(result.active_project_id || 'unbound_project'),
            session_id: String(result.active_session_id || 'session_unbound'),
            dispatch_id: result.active_dispatch_id ? String(result.active_dispatch_id) : null,
          });
        }
      );
    });
  }

  private readCandidateBuffer(): Promise<CopilotClipboardCandidate[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get([COPILOT_CANDIDATE_BUFFER_KEY], (result) => {
        const buffer = Array.isArray(result[COPILOT_CANDIDATE_BUFFER_KEY])
          ? (result[COPILOT_CANDIDATE_BUFFER_KEY] as CopilotClipboardCandidate[])
          : [];
        resolve(buffer);
      });
    });
  }

  private computeSignature(text: string, capturedAt: string): CopilotSignature {
    const normalized = normalizeText(text);
    return {
      text_hash: computeTextHash(normalized),
      normalized_length: normalized.length,
      excerpt: normalized.slice(0, 240),
      captured_at: capturedAt,
    };
  }

  private resolveBufferDedupMatch(
    signature: CopilotSignature,
    buffer: CopilotClipboardCandidate[],
    context: { project_id: string; session_id: string }
  ): DedupMatch | null {
    const capturedAtMs = new Date(signature.captured_at).getTime();
    for (const candidate of buffer) {
      if (candidate.project_id !== context.project_id) continue;
      if (context.session_id !== 'session_unbound' && candidate.session_id !== context.session_id) continue;

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

  private lookupNativeDedupMatch(
    signature: CopilotSignature,
    context: { project_id: string; session_id: string }
  ): Promise<DedupMatch | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'lookup_copilot_candidate',
          payload: {
            project_id: context.project_id,
            session_id: context.session_id,
            ...signature,
          },
        },
        (response: any) => {
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
        }
      );
    });
  }

  private async classifyAndEmitTurn(role: ChatRole, text: string, turnIndex: number): Promise<void> {
    const classified = classifyTurnDeterministic(role, text);
    if (!classified) return;

    const context = await this.readActiveBindingContext();
    let correlatedCandidateId: string | null = null;
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
      } else {
        const nativeMatch = await this.lookupNativeDedupMatch(signature, context);
        if (nativeMatch) {
          correlatedCandidateId = nativeMatch.candidate_id;
          summaryReason = nativeMatch.summary_reason;
          signals.push('dedup:native_lookup');
        } else {
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

  private observeConversations(): void {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const added = Array.from(m.addedNodes || []).filter((n) => n.nodeType === 1) as Element[];
        for (const node of added) {
          const el = node as HTMLElement;
          const text = el.innerText && el.innerText.trim();
          if (!text) continue;

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
          if (this.emittedSignatures.has(sig)) continue;
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
  private readonly chatGPTOrigins = [
    'https://chatgpt.com',
    'https://www.chatgpt.com',
    'https://chat.openai.com',
  ];

  private readonly config: CopyInterceptorConfig;
  private listeningForCopy = false;
  private lastCopySignature: { key: string; ts: number } | null = null;

  private readonly implementationPhrases = [
    'what i changed',
    'build status',
    'files changed',
    'implemented',
    'fixed',
    'rebuilt',
    'exact files changed',
    'ran terminal command',
  ];

  constructor(config: CopyInterceptorConfig = {}) {
    this.config = config;
    this.init();
  }

  private init(): void {
    if (!this.isOnChatGPT()) {
      this.log('Not on ChatGPT - interceptor inactive');
      return;
    }

    this.log('CopyInterceptor: initializing on ChatGPT');
    this.setupCopyListener();
    this.setupCanvasClickListener();
  }

  private setupCopyListener(): void {
    document.addEventListener('copy', (event: ClipboardEvent) => {
      this.handleCopyEvent(event, 'manual');
    });

    this.listeningForCopy = true;
    this.log('Copy listener registered');
  }

  private setupCanvasClickListener(): void {
    document.addEventListener('click', (event: MouseEvent) => {
      const rawTarget = event.target as HTMLElement;
      const button = rawTarget.closest('button, [role="button"]') as HTMLElement | null;

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

  private handleCopyEvent(
    event: ClipboardEvent,
    selectionType: 'manual' | 'canvas'
  ): void {
    const clipboardText = event.clipboardData?.getData('text/plain') || '';
    const selectionText = window.getSelection?.()?.toString() || '';
    const copiedText = clipboardText.trim().length > 0 ? clipboardText : selectionText;

    if (clipboardText.trim().length > 0) {
      this.log('Manual copy used clipboardData');
    } else if (selectionText.trim().length > 0) {
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

  private handleCopyButton(
    buttonElement: HTMLElement,
    surface: 'standard' | 'canvas'
  ): void {
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
      this.log(
        `Resolved canvas wrapper: <${resolved.wrapper.tagName.toLowerCase()}> ${resolved.wrapper.className || '[no-class]'}`
      );
      this.log(
        `Resolved canvas content container: <${resolved.contentNode.tagName.toLowerCase()}> ${resolved.contentNode.className || '[no-class]'}`
      );
    } else {
      this.log(
        `Resolved standard turn wrapper: <${resolved.wrapper.tagName.toLowerCase()}> ${resolved.wrapper.className || '[no-class]'}`
      );
      this.log(
        `Resolved standard content container: <${resolved.contentNode.tagName.toLowerCase()}> ${resolved.contentNode.className || '[no-class]'}`
      );
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

  private async evaluateAndStageCopilotCandidate(
    rawText: string,
    context: { chatId: string; selectionType: 'manual' | 'canvas'; sourceUrl: string }
  ): Promise<void> {
    const signalFlags = this.computeCopilotSignalFlags(rawText);
    if (!signalFlags.threshold_passed) {
      this.log('Discriminator rejected clipboard candidate');
      return;
    }

    const storage = await this.getStorageSnapshot();
    const candidate: CopilotClipboardCandidate = {
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

  private computeCopilotSignalFlags(text: string): CopilotSignalFlags {
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

    const technicalScore =
      (highFileListingBlock ? 3 : 0)
      + (highNestedRefs ? 3 : 0)
      + (mediumSectionHeader ? 2 : 0)
      + (mediumAnyExtractedRef ? 2 : 0)
      + (lowProseEmbeddedPath ? 1 : 0)
      + (lowHeadingFamily ? 1 : 0)
      + (lowVeryLongText ? 1 : 0);

    const buildScore =
      (highCommandResult ? 3 : 0)
      + (mediumValidationHeader ? 2 : 0)
      + (mediumKnownBuildCommand ? 2 : 0)
      + (lowHeadingFamily ? 1 : 0)
      + (lowVeryLongText ? 1 : 0);

    const completionScore =
      (highCompletionMarker ? 3 : 0)
      + (lowHeadingFamily ? 1 : 0)
      + (lowVeryLongText ? 1 : 0);

    const technicalSupportingMarkers = [mediumSectionHeader, mediumAnyExtractedRef, lowProseEmbeddedPath].filter(Boolean).length;
    const technicalHasStrong = highFileListingBlock || highNestedRefs;
    const technicalStructureOk = (
      (highFileListingBlock || (mediumAnyExtractedRef && mediumSectionHeader))
      && technicalScore >= 3
      && (technicalHasStrong || technicalSupportingMarkers >= 2)
    );

    const buildDiagnosticOk = (highCommandResult || mediumKnownBuildCommand || mediumValidationHeader) && buildScore >= 3;
    const completionMarkerOk = highCompletionMarker && completionScore >= 3;
    const totalScore = technicalScore + buildScore + completionScore;
    const structuralIntegrityOk = totalScore >= 7;

    const matchedSignals: string[] = [];
    if (minLengthOk) matchedSignals.push('length_threshold');
    if (technicalStructureOk) matchedSignals.push('technical_structure');
    if (implementationLanguageOk) matchedSignals.push('implementation_language');
    if (buildDiagnosticOk) matchedSignals.push('build_diagnostic');
    if (completionMarkerOk) matchedSignals.push('completion_marker');
    if (structuralIntegrityOk) matchedSignals.push('structural_integrity');

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

  private getStorageSnapshot(): Promise<{
    activeProjectId: string | null;
    activeSessionId: string | null;
    activeDispatchId: string | null;
  }> {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['active_project_id', 'active_session_id', 'active_dispatch_id'],
        (result) => {
          resolve({
            activeProjectId: typeof result.active_project_id === 'string' ? result.active_project_id : null,
            activeSessionId: typeof result.active_session_id === 'string' ? result.active_session_id : null,
            activeDispatchId: typeof result.active_dispatch_id === 'string' ? result.active_dispatch_id : null,
          });
        }
      );
    });
  }

  private stageCandidateInBuffer(candidate: CopilotClipboardCandidate): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.get([COPILOT_CANDIDATE_BUFFER_KEY], (result) => {
        const existing = Array.isArray(result[COPILOT_CANDIDATE_BUFFER_KEY])
          ? (result[COPILOT_CANDIDATE_BUFFER_KEY] as CopilotClipboardCandidate[])
          : [];
        const next = [candidate, ...existing].slice(0, COPILOT_CANDIDATE_BUFFER_LIMIT);
        chrome.storage.local.set({ [COPILOT_CANDIDATE_BUFFER_KEY]: next }, () => resolve());
      });
    });
  }

  private emitCopilotCandidateCaptured(candidate: CopilotClipboardCandidate): void {
    chrome.runtime.sendMessage(
      {
        type: 'copilot_candidate_captured',
        payload: candidate,
      },
      (_response: unknown) => {
        if (chrome.runtime.lastError) {
          this.log(`Error emitting copilot candidate: ${chrome.runtime.lastError.message}`);
          return;
        }
        this.log(`Staged copilot candidate ${candidate.candidate_id}`);
      }
    );
  }

  private sendCopyBindingRequest(event: {
    chat_id: string;
    copied_text: string;
    selection_type: 'manual' | 'canvas';
    source_url: string;
    created_at: string;
  }): void {
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

      chrome.runtime.sendMessage(
        {
          type: 'copy_binding_requested',
          payload: {
            ...event,
            summary,
            project_id: projectId,
          },
        },
        (_response: unknown) => {
          if (chrome.runtime.lastError) {
            this.log(`Error sending message: ${chrome.runtime.lastError.message}`);
            return;
          }

          this.log('Copy binding request sent to background');
        }
      );
    });
  }

  private isDuplicateCopy(text: string, selectionType: 'manual' | 'canvas', sourceUrl: string): boolean {
    const normalized = normalizeText(text).slice(0, 280);
    if (!normalized) return true;

    const key = `${selectionType}|${sourceUrl}|${computeTextHash(normalized)}`;
    const now = Date.now();
    const last = this.lastCopySignature;
    this.lastCopySignature = { key, ts: now };

    if (!last) return false;
    return last.key === key && now - last.ts < 1500;
  }

  private extractChatId(): string | null {
    const urlMatch = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }

    const pageState = (window as any).__INITIAL_STATE__;
    if (pageState?.chatId) {
      return pageState.chatId;
    }

    return null;
  }

  private isStandardResponseCopyButton(button: HTMLElement): boolean {
    const dataTestId = button.getAttribute('data-testid');
    const ariaLabel = button.getAttribute('aria-label');
    return dataTestId === 'copy-turn-action-button' && ariaLabel === 'Copy response';
  }

  private isCanvasCopyButton(button: HTMLElement, rawTarget: HTMLElement): boolean {
    if (this.isStandardResponseCopyButton(button)) {
      return false;
    }

    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const title = (button.getAttribute('title') || '').toLowerCase();
    const text = (button.textContent || '').trim().toLowerCase();
    const rawText = (rawTarget.textContent || '').trim().toLowerCase();

    const looksLikeCopy =
      ariaLabel.includes('copy')
      || title.includes('copy')
      || text === 'copy'
      || rawText.includes('copy');

    return looksLikeCopy;
  }

  private logCanvasClickCandidate(rawTarget: HTMLElement, button: HTMLElement | null): void {
    const clickedTag = rawTarget.tagName.toLowerCase();
    const buttonTag = button ? button.tagName.toLowerCase() : '-';
    const buttonAriaLabel = button?.getAttribute('aria-label') || '-';
    const buttonDataTestId = button?.getAttribute('data-testid') || '-';
    const buttonClassName = button?.className || '-';

    this.log(
      `Canvas click candidate: clicked tag=${clickedTag} nearest button tag=${buttonTag} nearest button aria-label=${buttonAriaLabel} nearest button data-testid=${buttonDataTestId} nearest button className=${buttonClassName}`
    );
  }

  private resolveStandardResponseCopyContent(
    buttonElement: HTMLElement
  ): { wrapper: HTMLElement; contentNode: HTMLElement } | null {
    const actionsGroup = buttonElement.closest(
      'div[aria-label="Response actions"][role="group"]'
    ) as HTMLElement | null;

    if (!actionsGroup) {
      this.log('Warning: standard copy button click was not inside response actions group');
      return null;
    }

    let current: HTMLElement | null = actionsGroup;
    let depth = 0;

    while (current && depth < 8) {
      const assistantScope = current.matches('[data-message-author-role="assistant"]')
        ? current
        : current.querySelector('[data-message-author-role="assistant"]');
      const assistantRoot = assistantScope as HTMLElement | null;

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

  private resolveCanvasCopyContent(
    buttonElement: HTMLElement
  ): { wrapper: HTMLElement; contentNode: HTMLElement } | null {
    const canvasWrapper = this.findCanvasWrapper(buttonElement);
    const scopeRoot = canvasWrapper ?? document.body;

    const actionsGroup = buttonElement.closest(
      'div[aria-label="Response actions"][role="group"]'
    ) as HTMLElement | null;

    if (actionsGroup) {
      const siblingContent = this.findSiblingContentNearActions(actionsGroup, 20);
      if (siblingContent) {
        return { wrapper: scopeRoot, contentNode: siblingContent };
      }
    }

    let current: HTMLElement | null = buttonElement.parentElement;
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

  private findCanvasWrapper(buttonElement: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = buttonElement;
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

    return buttonElement.closest('[role="dialog"]') as HTMLElement | null;
  }

  private findSiblingContentNearActions(
    actionsGroup: HTMLElement,
    minTextLength: number
  ): HTMLElement | null {
    const actionHost = actionsGroup.parentElement;
    if (!actionHost) {
      return null;
    }

    let sibling: Element | null = actionHost.previousElementSibling;
    while (sibling) {
      const siblingElement = sibling as HTMLElement;
      if (this.isUsableContentNode(siblingElement, actionsGroup, minTextLength)) {
        return siblingElement;
      }
      sibling = sibling.previousElementSibling;
    }

    return null;
  }

  private findBestContentCandidate(
    scopeRoot: HTMLElement,
    actionsGroup: HTMLElement | null,
    minTextLength: number
  ): HTMLElement | null {
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

    const candidates = Array.from(
      scopeRoot.querySelectorAll(selectors.join(', '))
    ) as HTMLElement[];

    let best: HTMLElement | null = null;
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

  private isUsableContentNode(
    candidate: HTMLElement,
    actionsGroup: HTMLElement | null,
    minTextLength: number
  ): boolean {
    if (actionsGroup) {
      if (
        candidate === actionsGroup
        || candidate.contains(actionsGroup)
        || actionsGroup.contains(candidate)
      ) {
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

  private logCopyButtonAncestorChain(
    buttonElement: HTMLElement,
    branchLabel: 'standard' | 'canvas'
  ): void {
    if (!this.config.debug) {
      return;
    }

    const lines: string[] = [];
    let current: HTMLElement | null = buttonElement;
    for (let i = 0; i < 8 && current; i += 1) {
      lines.push(
        `${i}: <${current.tagName.toLowerCase()}> data-testid=${current.getAttribute('data-testid') || '-'} aria-label=${current.getAttribute('aria-label') || '-'} role=${current.getAttribute('role') || '-'} class=${current.className || '-'}`
      );
      current = current.parentElement;
    }

    this.log(`${branchLabel} copy button ancestor chain\n${lines.join('\n')}`);
  }

  private extractTextFromMessageBlock(messageBlock: HTMLElement): string {
    const text = messageBlock.textContent || '';
    return text
      .replace(/\s*copy\s*/gi, '')
      .replace(/\s*edit\s*/gi, '')
      .trim();
  }

  private isOnChatGPT(): boolean {
    const origin = window.location.origin;
    return this.chatGPTOrigins.some((allowedOrigin) => origin.includes(allowedOrigin));
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[CopyInterceptor] ${message}`);
    }
  }
}

new ChatObserver({ debug: true });
new CopyInterceptor({ debug: true });

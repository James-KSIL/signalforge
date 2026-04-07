import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export type CopilotCandidatePayload = {
  candidate_id: string;
  project_id: string;
  session_id: string;
  dispatch_id?: string | null;
  contract_ref?: string | null;
  captured_at: string;
  source: 'clipboard';
  raw_text: string;
  content_hash?: string | null;
  signal_flags?: Record<string, unknown>;
  capture_context?: Record<string, unknown>;
};

export type ExecutionSignals = {
  build_command_detected: boolean;
  test_result_detected: boolean;
  command_outcome_line_detected: boolean;
};

export type ContractGateResult = {
  gatePass: boolean;
  failedInvariants: string[];
  gateFailureReason: string | null;
  executionSignals: ExecutionSignals;
  executionSignalsCount: number;
  resolvedWorkspaceFiles: string[];
};

export type ValidationResult = {
  ok: boolean;
  candidateId: string;
  reasons: string[];
  extractedFileRefs: string[];
  matchedWorkspaceFiles: string[];
  matchedDiffFiles: string[];
  evidence: {
    length_ok: boolean;
    technical_markers_ok: boolean;
    build_diagnostic_ok: boolean;
    completion_marker_ok: boolean;
    signal_total_score: number;
    technical_signal_score: number;
    build_signal_score: number;
    completion_signal_score: number;
    workspace_refs_ok: boolean;
    git_correlation_ok: boolean;
    semantic_alignment_ok: boolean;
    structural_integrity_ok: boolean;
    session_binding_ok: boolean;
  };
};

export type ValidationContext = {
  workspaceRoot?: string;
  gitModifiedFiles?: string[];
  workspaceFiles?: string[];
  buildSignals?: string[];
};

const MIN_NORMALIZED_LENGTH = 280;
const MAX_FILE_REFS_PER_CANDIDATE = 50;
const MAX_PATH_LENGTH = 260; // Windows MAX_PATH

function normalizeText(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/[\t ]+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

type SignalScoreBreakdown = {
  totalScore: number;
  technicalScore: number;
  buildScore: number;
  completionScore: number;
  technicalStructureOk: boolean;
  buildDiagnosticOk: boolean;
  completionMarkerOk: boolean;
};

function detectExecutionSignals(text: string): ExecutionSignals {
  return {
    build_command_detected: /\b(pnpm|pytest|python\s+-m\s+unittest|npm\s+run|cargo\s+build|go\s+build)\b/i.test(text),
    test_result_detected: /\b(pass(?:ed)?|fail(?:ed)?|tests?\s+passing|tests?\s+failed|\d+\s+passed)\b/i.test(text),
    command_outcome_line_detected: /->\s*(PASS|FAIL)\b|\bExit\s+code\s*:?(?:\s*)0\b|\bSuccess\b|\bFAILED\b/i.test(text),
  };
}

function normalizeRef(ref: string): string {
  let normalized = ref.trim();
  normalized = normalized.replace(/^[`"'\[]+/, '').replace(/[`"'\],;:.]+$/, '');
  normalized = normalized.replace(/\\/g, '/');
  normalized = normalized.replace(/^\.\//, '');
  return normalized;
}

/**
 * SECURITY: Strip absolute path prefixes and treat as relative.
 * If an extracted ref looks like an absolute path (C:\, /home/, etc.),
 * convert it to a relative path by removing the drive/root prefix.
 * This prevents untrusted content from escaping the workspace.
 */
function sanitizeAbsolutePath(candidate: string): string {
  let result = candidate;
  
  // Strip Windows drive letters: C:\ → remove C:\
  result = result.replace(/^[A-Za-z]:[/\\]/, '');
  
  // Strip Unix absolute path: /home/ → remove leading /
  result = result.replace(/^[/\\]+/, '');
  
  return result;
}

/**
 * SECURITY: Verify that a resolved path stays within workspace_root.
 * Prevents path traversal attacks like ../../etc/passwd
 */
function isPathWithinWorkspace(resolvedPath: string, workspaceRoot: string): boolean {
  const normalizedBase = path.resolve(workspaceRoot);
  const normalizedPath = path.resolve(resolvedPath);
  
  // Ensure resolved path starts with workspace root
  // Use path separators and trailing separator to prevent prefix matching attacks
  const pathWithSeparator = normalizedPath.endsWith(path.sep) ? normalizedPath : normalizedPath + path.sep;
  const baseWithSeparator = normalizedBase.endsWith(path.sep) ? normalizedBase : normalizedBase + path.sep;
  
  return pathWithSeparator.startsWith(baseWithSeparator) || normalizedPath === normalizedBase;
}

/**
 * Guard stack for identifying valid file paths (language-agnostic).
 * Apply guards in THIS EXACT ORDER - reject on first match.
 * Accept if all guards pass.
 */
function isValidFilePath(candidate: string): boolean {
  // Guard 0: SECURITY - Reject paths exceeding Windows MAX_PATH (260 characters)
  if (candidate.length > MAX_PATH_LENGTH) {
    return false;
  }

  // Guard 1: Reject URL scheme prefixes
  if (/^(https?|ftps?|ssh|git|wss?|file|chrome|mailto|tel):\/?\/.*/i.test(candidate)) {
    return false;
  }

  // Guard 2: Reject @ symbol (emails, git SSH, scoped npm packages)
  if (/@/.test(candidate)) {
    return false;
  }

  // Guard 3: Reject colon followed by digits (localhost:3000, IP:port, ISO timestamps)
  if (/:[\d]/.test(candidate)) {
    return false;
  }

  // Guard 4: Reject bare hostname/domain pattern
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(candidate)) {
    return false;
  }

  // Guard 5: Reject semver/version pattern (v1.2.3, ^2.0.0, >=1.0.0, ~1.2.3)
  if (/^[v~^><]*\d+\.\d+/.test(candidate)) {
    return false;
  }

  // Guard 6: Reject if no directory separator (/ or \) anywhere
  if (!/[/\\]/.test(candidate)) {
    return false;
  }

  // Guard 7: Reject if no file extension (no . after last directory separator)
  const lastSep = Math.max(candidate.lastIndexOf('/'), candidate.lastIndexOf('\\'));
  const filename = lastSep >= 0 ? candidate.slice(lastSep + 1) : candidate;
  if (!filename.includes('.')) {
    return false;
  }

  // Guard 8: Reject if extension is empty or whitespace only
  const lastDot = filename.lastIndexOf('.');
  if (lastDot >= 0) {
    const extension = filename.slice(lastDot + 1);
    if (!extension || /^\s+$/.test(extension)) {
      return false;
    }
  }

  return true;
}

export function extractFileReferences(rawText: string): string[] {
  const refs: string[] = [];

  // Strategy 1: Look for strong signal keywords followed by file paths
  // These are high-confidence indicators regardless of context
  const signalKeywordPattern = /(Created|Modified|Updated|Deleted|Added|Changed|Files\s+changed|file|path|→|->)\s+([A-Za-z0-9_.:/\\~#^-]+(?:[/\\][A-Za-z0-9_.:/\\~#^-]+)*\.[A-Za-z0-9_-]+)/gi;
  for (const match of rawText.matchAll(signalKeywordPattern)) {
    if (refs.length >= MAX_FILE_REFS_PER_CANDIDATE) {
      console.warn(`[SignalForge][extractFileReferences] Reached maximum refs cap (${MAX_FILE_REFS_PER_CANDIDATE}), stopping extraction`);
      break;
    }
    let candidate = normalizeRef(match[2]);
    // SECURITY: Sanitize absolute paths to relative
    candidate = sanitizeAbsolutePath(candidate);
    if (isValidFilePath(candidate)) {
      refs.push(candidate);
    }
  }

  // Strategy 2: Scan the ENTIRE prose text for path-shaped tokens,
  // not only lines with strong signal keywords.
  const generalPathPattern = /(^|[^A-Za-z0-9_])((?:[A-Za-z]:[/\\]|\.\.?[/\\]|[/\\])?(?:[A-Za-z0-9_.-]+[/\\])+[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]+)(?=$|[^A-Za-z0-9_])/g;
  for (const match of rawText.matchAll(generalPathPattern)) {
    if (refs.length >= MAX_FILE_REFS_PER_CANDIDATE) {
      console.warn(`[SignalForge][extractFileReferences] Reached maximum refs cap (${MAX_FILE_REFS_PER_CANDIDATE}), stopping extraction`);
      break;
    }
    let candidate = normalizeRef(match[2]);
    // SECURITY: Sanitize absolute paths to relative
    candidate = sanitizeAbsolutePath(candidate);
    if (isValidFilePath(candidate)) {
      refs.push(candidate);
    }
  }

  return unique(refs);
}

export function passesContractGate(
  candidate: CopilotCandidatePayload,
  context: ValidationContext = {}
): ContractGateResult {
  const failedInvariants: string[] = [];
  const normalized = normalizeText(candidate.raw_text || '');
  const extractedFileRefs = extractFileReferences(normalized);
  const workspaceRoot = typeof context.workspaceRoot === 'string' ? context.workspaceRoot.trim() : '';
  const resolvedWorkspaceFiles = resolveWorkspaceMatches(extractedFileRefs, workspaceRoot, context.workspaceFiles);
  const executionSignals = detectExecutionSignals(normalized);
  const executionSignalsCount = [
    executionSignals.build_command_detected,
    executionSignals.test_result_detected,
    executionSignals.command_outcome_line_detected,
  ].filter(Boolean).length;

  if (resolvedWorkspaceFiles.length < 1) {
    failedInvariants.push('file_refs.length >= 1 (resolved within workspace)');
  }

  if (executionSignalsCount < 1) {
    failedInvariants.push('execution_signals_count >= 1');
  }

  if (typeof candidate.source !== 'string' || !candidate.source.trim()) {
    failedInvariants.push('source !== null');
  }

  if (typeof candidate.content_hash !== 'string' || !candidate.content_hash.trim()) {
    failedInvariants.push('content_hash !== null');
  }

  const gatePass = failedInvariants.length === 0;

  return {
    gatePass,
    failedInvariants,
    gateFailureReason: gatePass ? null : failedInvariants[0],
    executionSignals,
    executionSignalsCount,
    resolvedWorkspaceFiles,
  };
}

function hasNestedPath(ref: string): boolean {
  return normalizeRef(ref).includes('/');
}

function computeSignalScore(text: string, extractedFileRefs: string[]): SignalScoreBreakdown {
  const highCompletionMarker = /(?:^|\n)\s{0,3}(?:#{1,6}\s*)?(Implementation Complete|Major Implementation Complete|Final Outcome|Outcome|Result)\b|##\s*Implementation\b/i.test(text);
  const highFileListingBlock = /\b(Created|Modified|Deleted)\s*:\s*[^\n]*(?:[A-Za-z0-9_.-]+[\\/])+[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]+/i.test(text);
  const highCommandResult = /(->\s*(PASS|FAIL)\b|\bPASS\b|\bFAILED\b|\bSuccess\b|\bExit\s+code\s*:?\s*0\b)/i.test(text);
  const highNestedRefs = extractedFileRefs.filter(hasNestedPath).length >= 2;

  const mediumSectionHeader = /\b(Files Changed|Change Inventory|Validation|Validation Matrix|Build Status|Detailed Changes|Scope|What Changed|File-by-File Highlights)\b/i.test(text);
  const mediumValidationHeader = /\b(Validation|Validation Matrix)\b/i.test(text);
  const mediumKnownBuildCommand = /\b(pnpm|pytest|python\s+-m\s+unittest|npm\s+run|cargo\s+build|go\s+build)\b/i.test(text);
  const mediumAnyExtractedRef = extractedFileRefs.length >= 1;

  const lowProseEmbeddedPath = /(?:^|[^A-Za-z0-9_])(?:[A-Za-z0-9_.-]+[\\/])+[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]+(?=$|[^A-Za-z0-9_])/i.test(text);
  const lowHeadingFamily = /(?:^|\n)\s{0,3}(?:#{1,6}\s*)?[^\n]*(Implementation|Validation|Outcome|Result)[^\n]*/i.test(text);
  const lowVeryLongText = text.length > 2000;

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

  const totalScore = technicalScore + buildScore + completionScore;

  const technicalSupportingMarkers = [mediumSectionHeader, mediumAnyExtractedRef, lowProseEmbeddedPath].filter(Boolean).length;
  const technicalHasStrong = highFileListingBlock || highNestedRefs;
  const technicalStructureOk = (
    (highFileListingBlock || (mediumAnyExtractedRef && mediumSectionHeader))
    && technicalScore >= 3
    && (technicalHasStrong || technicalSupportingMarkers >= 2)
  );

  const buildDiagnosticOk = (highCommandResult || mediumKnownBuildCommand || mediumValidationHeader) && buildScore >= 3;

  // Anti-noise: completion must be explicit completion/outcome language.
  const completionMarkerOk = highCompletionMarker && completionScore >= 3;

  return {
    totalScore,
    technicalScore,
    buildScore,
    completionScore,
    technicalStructureOk,
    buildDiagnosticOk,
    completionMarkerOk,
  };
}

function detectStructuralIntegrity(totalScore: number): boolean {
  return totalScore >= 7;
}

function safeGitRoot(startDir: string): string | null {
  try {
    const root = execSync('git rev-parse --show-toplevel', { cwd: startDir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return root || null;
  } catch {
    return null;
  }
}

function getGitModifiedFiles(root: string): string[] {
  try {
    const output = execSync('git diff --name-only', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return unique(output.split(/\r?\n/).map((line: string) => line.trim()).filter(Boolean).map((line: string) => line.replace(/\\/g, '/')));
  } catch {
    return [];
  }
}

function resolveWorkspaceMatches(fileRefs: string[], workspaceRoot: string, workspaceFiles?: string[]): string[] {
  if (fileRefs.length === 0) return [];

  const manifest = workspaceFiles ? new Set(workspaceFiles.map((f) => f.replace(/\\/g, '/'))) : null;
  const matches: string[] = [];

  for (const ref of fileRefs) {
    const normalized = normalizeRef(ref);
    if (!normalized) continue;

    // SECURITY: Path traversal prevention
    // Verify resolved path stays within workspace_root. If not, silently discard.
    const resolvedPath = workspaceRoot ? path.resolve(workspaceRoot, normalized) : '';
    
    if (workspaceRoot && !isPathWithinWorkspace(resolvedPath, workspaceRoot)) {
      // Path tried to escape workspace (e.g., ../../etc/passwd). Silently discard.
      continue;
    }

    // SECURITY: Filesystem check sandboxing
    // Only check fs.existsSync with the bounded resolved path, never raw string
    const onDiskExists = !!workspaceRoot && fs.existsSync(resolvedPath);

    if (manifest) {
      const found = Array.from(manifest).find((candidate) => candidate.endsWith(normalized));
      if (found) matches.push(found);
      continue;
    }

    if (workspaceRoot) {
      if (onDiskExists) {
        matches.push(normalized);
      }
    }
  }

  return unique(matches);
}

function resolveDiffMatches(fileRefs: string[], modifiedFiles: string[]): string[] {
  if (fileRefs.length === 0 || modifiedFiles.length === 0) return [];
  return unique(
    fileRefs.filter((ref) => modifiedFiles.some((modified) => modified.endsWith(normalizeRef(ref))))
      .map((ref) => normalizeRef(ref))
  );
}

function semanticAlignment(text: string, fileRefs: string[], diffMatches: string[], buildSignals: string[] = []): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const lower = text.toLowerCase();

  if (/exact files changed/.test(lower) && diffMatches.length === 0) {
    notes.push('Claimed exact files changed but no references matched modified files.');
  }

  if (/updated\s+/i.test(text) && fileRefs.length === 0) {
    notes.push('Claimed updates but no file references were extracted.');
  }

  if (/fixed module resolution/i.test(text)) {
    const touchesImportFiles = diffMatches.some((f) => /(tsconfig|package\.json|pnpm-lock|vite\.config|webpack|eslintrc)/i.test(f));
    if (!touchesImportFiles) {
      notes.push('Claimed module resolution fix without touching import/build config files.');
    }
  }

  if (/build passed/i.test(lower) && buildSignals.length === 0) {
    notes.push('Claimed build passed without corroborating build signal.');
  }

  return { ok: notes.length === 0, notes };
}

export function validateCopilotCandidate(
  candidate: CopilotCandidatePayload,
  context: ValidationContext = {}
): ValidationResult {
  const reasons: string[] = [];
  const normalized = normalizeText(candidate.raw_text || '');
  const extractedFileRefs = extractFileReferences(normalized);
  const signalScores = computeSignalScore(normalized, extractedFileRefs);

  const workspaceRoot = typeof context.workspaceRoot === 'string' ? context.workspaceRoot.trim() : '';
  const hasWorkspaceRoot = !!workspaceRoot && fs.existsSync(workspaceRoot);
  const gitRoot = hasWorkspaceRoot ? (safeGitRoot(workspaceRoot) || workspaceRoot) : null;
  const modifiedFiles = context.gitModifiedFiles || (gitRoot ? getGitModifiedFiles(gitRoot) : []);
  const matchedWorkspaceFiles = resolveWorkspaceMatches(extractedFileRefs, workspaceRoot, context.workspaceFiles);
  const matchedDiffFiles = resolveDiffMatches(extractedFileRefs, modifiedFiles);

  const lengthOk = normalized.length >= MIN_NORMALIZED_LENGTH;
  if (!lengthOk) reasons.push(`Normalized text shorter than minimum threshold (${MIN_NORMALIZED_LENGTH}).`);

  const technicalMarkersOk = signalScores.technicalStructureOk;
  if (!technicalMarkersOk) reasons.push('Missing technical implementation markers.');

  const buildDiagnosticOk = signalScores.buildDiagnosticOk;
  const completionMarkerOk = signalScores.completionMarkerOk;

  const workspaceRefsOk = extractedFileRefs.length === 0
    ? false
    : matchedWorkspaceFiles.length > 0;
  if (!workspaceRefsOk) reasons.push('Extracted file references did not resolve in workspace.');

  if (!hasWorkspaceRoot) {
    reasons.push('Workspace root unavailable for validator file and git resolution.');
  }

  const gitCorrelationOk = matchedDiffFiles.length > 0;
  if (!gitCorrelationOk) reasons.push('No overlap between extracted file references and git diff.');

  const semantic = semanticAlignment(normalized, extractedFileRefs, matchedDiffFiles, context.buildSignals);
  if (!semantic.ok) reasons.push(...semantic.notes);

  const structuralIntegrityOk = detectStructuralIntegrity(signalScores.totalScore);
  if (!structuralIntegrityOk) reasons.push('Structural integrity failed: generic/repetitive or low-evidence narrative.');

  const sessionBindingOk = !!candidate.project_id
    && !!candidate.session_id
    && candidate.project_id !== 'unbound_project'
    && candidate.session_id !== 'session_unbound';
  if (!sessionBindingOk) reasons.push('Missing active project/session binding context.');

  const evidence = {
    length_ok: lengthOk,
    technical_markers_ok: technicalMarkersOk,
    build_diagnostic_ok: buildDiagnosticOk,
    completion_marker_ok: completionMarkerOk,
    signal_total_score: signalScores.totalScore,
    technical_signal_score: signalScores.technicalScore,
    build_signal_score: signalScores.buildScore,
    completion_signal_score: signalScores.completionScore,
    workspace_refs_ok: workspaceRefsOk,
    git_correlation_ok: gitCorrelationOk,
    semantic_alignment_ok: semantic.ok,
    structural_integrity_ok: structuralIntegrityOk,
    session_binding_ok: sessionBindingOk,
  };

  const ok = Object.values(evidence).every((v) => v === true);

  return {
    ok,
    candidateId: candidate.candidate_id,
    reasons,
    extractedFileRefs,
    matchedWorkspaceFiles,
    matchedDiffFiles,
    evidence,
  };
}

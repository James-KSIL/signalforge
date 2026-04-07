"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COPILOT_EVIDENCE_SCHEMA = exports.PROJECTS_SESSIONS_SCHEMA = exports.CHAT_EVENTS_SCHEMA = void 0;
exports.CHAT_EVENTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS chat_events (
  event_id TEXT PRIMARY KEY,
  chat_thread_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  session_id TEXT,
  dispatch_id TEXT,
  source TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  role TEXT,
  event_type TEXT NOT NULL,
  content TEXT NOT NULL,
  artifact_refs TEXT,
  source_url TEXT,
  matched_trigger TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_events_thread_id
ON chat_events(chat_thread_id);

CREATE INDEX IF NOT EXISTS idx_chat_events_type
ON chat_events(event_type);

CREATE INDEX IF NOT EXISTS idx_chat_events_project_id
ON chat_events(project_id);

CREATE INDEX IF NOT EXISTS idx_chat_events_dispatch_id
ON chat_events(dispatch_id);

CREATE INDEX IF NOT EXISTS idx_chat_events_created_at
ON chat_events(created_at);
`;
exports.PROJECTS_SESSIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  git_root TEXT NOT NULL UNIQUE,
  workspace_uri TEXT NOT NULL,
  default_branch TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  branch TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS outcomes (
  outcome_id TEXT PRIMARY KEY,
  project_id TEXT,
  session_id TEXT,
  dispatch_thread_id TEXT,
  status TEXT NOT NULL,
  title TEXT,
  what_changed TEXT,
  what_broke TEXT,
  next_step TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_outcomes_dispatch
ON outcomes(dispatch_thread_id);
`;
exports.COPILOT_EVIDENCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS copilot_candidate_staging (
  candidate_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  dispatch_id TEXT,
  contract_ref TEXT,
  captured_at TEXT NOT NULL,
  source TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  content_hash TEXT,
  signal_flags_json TEXT NOT NULL,
  capture_context_json TEXT,
  diagnostic_score INTEGER,
  gate_pass INTEGER,
  gate_failure_reason TEXT,
  failed_invariants_json TEXT,
  validation_status TEXT NOT NULL,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_copilot_candidate_staging_project
ON copilot_candidate_staging(project_id);

CREATE INDEX IF NOT EXISTS idx_copilot_candidate_staging_session
ON copilot_candidate_staging(session_id);

CREATE INDEX IF NOT EXISTS idx_copilot_candidate_staging_status
ON copilot_candidate_staging(validation_status);

CREATE TABLE IF NOT EXISTS copilot_execution_artifacts (
  artifact_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  dispatch_id TEXT,
  validated_at TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  extracted_file_refs_json TEXT,
  git_correlation_json TEXT,
  validation_evidence_json TEXT NOT NULL,
  source TEXT NOT NULL,
  artifact_type TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_copilot_execution_artifacts_project
ON copilot_execution_artifacts(project_id);

CREATE INDEX IF NOT EXISTS idx_copilot_execution_artifacts_session
ON copilot_execution_artifacts(session_id);

CREATE INDEX IF NOT EXISTS idx_copilot_execution_artifacts_validated_at
ON copilot_execution_artifacts(validated_at);

CREATE TABLE IF NOT EXISTS chatgpt_verification_events (
  verification_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  dispatch_id TEXT,
  thread_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  classification_signals_json TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chatgpt_verification_events_project
ON chatgpt_verification_events(project_id);

CREATE INDEX IF NOT EXISTS idx_chatgpt_verification_events_session
ON chatgpt_verification_events(session_id);

CREATE INDEX IF NOT EXISTS idx_chatgpt_verification_events_captured_at
ON chatgpt_verification_events(captured_at);

CREATE TABLE IF NOT EXISTS outcome_logs (
  outcome_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  dispatch_id TEXT NOT NULL,
  candidate_id TEXT,
  created_at TEXT NOT NULL,
  contract_ref TEXT,
  artifact_ref TEXT,
  verification_ref TEXT,
  rejection_reason TEXT,
  outcome_summary TEXT NOT NULL,
  outcome_status TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outcome_logs_project
ON outcome_logs(project_id);

CREATE INDEX IF NOT EXISTS idx_outcome_logs_session
ON outcome_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_outcome_logs_created_at
ON outcome_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_outcome_logs_candidate_id
ON outcome_logs(candidate_id);
`;

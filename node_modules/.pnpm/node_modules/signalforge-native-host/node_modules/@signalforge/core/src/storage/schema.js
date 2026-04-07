"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECTS_SESSIONS_SCHEMA = exports.CHAT_EVENTS_SCHEMA = void 0;
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

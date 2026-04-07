export type EventRole =
  | "system"
  | "user"
  | "assistant"
  | "worker"
  | "observer"
  | "outcome";

export type EventType =
  | "chat_turn_completed"
  | "dispatch_phrase_detected"
  | "dispatch_candidate_created"
  | "chatgpt_turn_classified"
  | "chatgpt_verification_captured"
  | "artifact_bound"
  | "outcome_auto_logged"
  | "workspace_errors_captured"
  | "session_started"
  | "session_ended"
  | "dispatch_seeded"
  | "dispatch_refreshed"
  | "outcome_logged"
  | "artifact_generated";

export type EventSource = "vscode" | "browser" | "cli";

export type EventContent = {
  summary: string;
  details?: string;
  status?: "success" | "fail" | "partial";
  artifacts?: string[];
  artifact_refs?: string[];
  metadata?: Record<string, any>;
};

export interface ForgeEvent {
  event_id: string;
  thread_id: string;
  project_id: string;
  session_id?: string;
  dispatch_id?: string;
  source: EventSource;
  role: EventRole;
  event_type: EventType;
  content: EventContent;
  timestamp: string;
}

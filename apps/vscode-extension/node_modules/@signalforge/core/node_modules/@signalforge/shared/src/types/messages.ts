import { BrowserEvent } from './events';
import { BoundArtifactEvent, CopyBindingEvent } from './binding';

export type BrowserBridgePayload = BrowserEvent | CopyBindingEvent | BoundArtifactEvent;

export interface NativeInboundMessage {
  kind: 'browser_event';
  message_id?: string;
  payload: BrowserBridgePayload;
}

export interface NativeAckMessage {
  type: 'ack';
  message_id: string;
  status: 'accepted';
}

export interface NativeErrorMessage {
  type: 'error';
  message_id: string;
  reason: string;
}

/**
 * Authoritative bootstrap authority event emitted by VS Code after capture_ready.
 * All fields are required and non-nullable. This is the canonical push payload shape.
 */
export interface BootstrapAuthorityEvent {
  type: 'bootstrap_authority';
  project_id: string;
  project_label: string;
  authority: 'vscode';
  timestamp: string; // ISO 8601
  workspace_root: string;
}

/**
 * Bootstrap authority response from native host — may carry null values
 * when no authority has been established (fallback null response).
 */
export interface NativeBootstrapAuthorityMessage {
  type: 'bootstrap_authority';
  message_id?: string;
  project_id: string | null;
  project_label: string | null;
  authority: string | null;
  timestamp?: string;
  workspace_root?: string | null;
  session_id?: string | null;
  dispatch_id?: string | null;
}

export interface NativeCopilotCandidateLookupMessage {
  type: 'copilot_candidate_lookup';
  message_id: string;
  found: boolean;
  candidate_id?: string | null;
  project_id?: string;
  session_id?: string;
  captured_at?: string;
  summary_reason?: string;
}

export type NativeBridgeResponse =
  | NativeAckMessage
  | NativeErrorMessage
  | NativeBootstrapAuthorityMessage
  | NativeCopilotCandidateLookupMessage;

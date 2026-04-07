type NativeBridgeResponse = {
  type?: 'ack' | 'error' | string;
  kind?: string;
  ok?: boolean;
  message_id?: string;
  eventId?: string;
  status?: string;
  reason?: string;
  error?: string;
  [key: string]: unknown;
};

const NATIVE_HOST_NAMES = ['com.signalforge.host', 'com.signalforge.nativehost'];

type PendingRequest = {
  resolve: (response: NativeBridgeResponse) => void;
  reject: (error: Error) => void;
};

type BootstrapAuthorityPayload = {
  type: 'bootstrap_authority';
  project_id: string;
  project_label: string;
  authority: string;
  timestamp: string;
  workspace_root?: string | null;
  session_id?: string | null;
  dispatch_id?: string | null;
};

let nativePort: chrome.runtime.Port | null = null;
let connectPromise: Promise<chrome.runtime.Port> | null = null;
const pendingRequests = new Map<string, PendingRequest>();
let lastBridgeError: string | null = null;
let nativePortDisconnected = false;
const bootstrapAuthorityListeners = new Set<(payload: BootstrapAuthorityPayload) => void>();

function messageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function setBridgeBadge(text: string, title?: string) {
  try {
    chrome.action.setBadgeText({ text });
    if (title) chrome.action.setTitle({ title });
  } catch {
    // ignore badge failures in environments without action UI
  }
}

function clearBridgeBadge() {
  try {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'SignalForge Chat Capture' });
  } catch {
    // ignore badge failures in environments without action UI
  }
}

function rejectPendingRequests(error: string) {
  for (const [id, pending] of pendingRequests.entries()) {
    pending.reject(new Error(error));
    pendingRequests.delete(id);
  }
}

function markPortDisconnected(error: string) {
  nativePort = null;
  connectPromise = null;
  nativePortDisconnected = true;
  setBridgeFailure(error);
  rejectPendingRequests(error);
}

function setBridgeFailure(error: string) {
  lastBridgeError = error;
  setBridgeBadge('!', error);
}

function clearBridgeFailure() {
  lastBridgeError = null;
  clearBridgeBadge();
}

function hasInvalidProjectId(responseData: any): boolean {
  if (!responseData || !Object.prototype.hasOwnProperty.call(responseData, 'project_id')) {
    return false;
  }

  const value = responseData.project_id;
  if (value == null) {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'null' || normalized === 'undefined') {
      return true;
    }
  }

  return false;
}

function notifyBootstrapAuthorityListeners(responseData: any) {
  if (responseData?.type !== 'bootstrap_authority' || !responseData?.project_id) {
    return;
  }

  const payload: BootstrapAuthorityPayload = {
    type: 'bootstrap_authority',
    project_id: String(responseData.project_id),
    project_label: String(responseData.project_label || responseData.project_id),
    authority: String(responseData.authority || 'vscode'),
    timestamp: String(responseData.timestamp || new Date().toISOString()),
    workspace_root: responseData.workspace_root ? String(responseData.workspace_root) : null,
    session_id: responseData.session_id ? String(responseData.session_id) : null,
    dispatch_id: responseData.dispatch_id ? String(responseData.dispatch_id) : null,
  };

  for (const listener of bootstrapAuthorityListeners.values()) {
    try {
      listener(payload);
    } catch {
      // Listener failures must not break bridge message handling.
    }
  }
}

function connectNativePort(): Promise<chrome.runtime.Port> {
  if (nativePort && !nativePortDisconnected) return Promise.resolve(nativePort);
  if (connectPromise) return connectPromise;

  connectPromise = new Promise<chrome.runtime.Port>((resolve, reject) => {
    try {
      console.log('[SignalForge] connecting native bridge', { hosts: NATIVE_HOST_NAMES });
      let port: chrome.runtime.Port | null = null;
      let lastConnectError: unknown = null;
      for (const hostName of NATIVE_HOST_NAMES) {
        try {
          port = chrome.runtime.connectNative(hostName);
          if (port) break;
        } catch (error: any) {
          lastConnectError = error;
        }
      }

      if (!port) {
        throw (lastConnectError || new Error('SignalForge local bridge unavailable'));
      }

      nativePort = port;
      nativePortDisconnected = false;

      port.onMessage.addListener((response: NativeBridgeResponse & { kind?: string; ok?: boolean; eventId?: string; error?: string }) => {
        const data: any = response;
        if (!data || typeof data.project_id !== 'string' || data.project_id.trim().length === 0) {
          return;
        }
        const responseData: any = data;
        const messageId = responseData?.message_id || responseData?.eventId || 'msg_unknown';

        const pending = pendingRequests.get(messageId);

        console.log('[SignalForge] native bridge message received', {
          message_id: messageId,
          type: responseData?.type,
          source: responseData?.source || null,
          hasPending: !!pending,
          project_id: responseData?.project_id || null,
        });

        if (responseData?.type === 'bootstrap_authority' && responseData?.source === 'signal_file_poll') {
          console.log('[SignalForge] bootstrap authority push routed from native host', {
            project_id: responseData?.project_id,
            project_label: responseData?.project_label,
            authority: responseData?.authority,
          });
          notifyBootstrapAuthorityListeners(responseData);
        }

        if (!pending) {
          if (responseData?.type === 'bootstrap_authority' && responseData?.source !== 'signal_file_poll') {
            notifyBootstrapAuthorityListeners(responseData);
          }
          return;
        }

        pendingRequests.delete(messageId);

        if (responseData?.type === 'bootstrap_authority') {
          console.log('[SignalForge] bootstrap authority response resolved pending request', {
            project_id: responseData?.project_id,
            source: responseData?.source || null,
          });
          clearBridgeFailure();
          pending.resolve(responseData);
          return;
        }

        if (responseData?.type === 'copilot_candidate_lookup') {
          clearBridgeFailure();
          pending.resolve(responseData);
          return;
        }

        if (responseData.type === 'ack' || responseData.kind === 'ack' || responseData.ok === true) {
          clearBridgeFailure();
          pending.resolve(responseData.type ? responseData : ({ type: 'ack', message_id: messageId, status: 'accepted' } as NativeBridgeResponse));
          return;
        }

        const reason = responseData.type === 'error'
          ? responseData.reason
          : responseData.error || 'SignalForge local bridge unavailable';
        setBridgeFailure(reason);
        pending.reject(new Error(reason));
      });

      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message || lastBridgeError || 'SignalForge local bridge unavailable';
        markPortDisconnected(error);
      });

      clearBridgeFailure();
      resolve(port);
    } catch (error: any) {
      const reason = error instanceof Error ? error.message : String(error);
      setBridgeFailure(reason);
      reject(error);
    }
  }).finally(() => {
    connectPromise = null;
  });

  return connectPromise;
}

async function sendNativeEnvelope(message: any): Promise<NativeBridgeResponse> {
  const port = await connectNativePort();
  const message_id = typeof message.message_id === 'string' && message.message_id.trim().length > 0
    ? message.message_id
    : messageId();
  const request = { ...message, message_id };

  const responsePromise = new Promise<NativeBridgeResponse>((resolve, reject) => {
    pendingRequests.set(message_id, { resolve, reject });
  });

  try {
    if (!port) {
      throw new Error(lastBridgeError || 'SignalForge local bridge unavailable');
    }

    port.postMessage(request);
  } catch (error: any) {
    pendingRequests.delete(message_id);
    const reason = error instanceof Error ? error.message : String(error);
    markPortDisconnected(reason || 'SignalForge local bridge unavailable');
    return Promise.reject(new Error(reason || 'SignalForge local bridge unavailable'));
  }

  return responsePromise;
}

export async function sendBrowserEvent(message: any): Promise<NativeBridgeResponse> {
  return sendNativeEnvelope(message);
}

export async function sendCopyBindingRequested(payload: any): Promise<NativeBridgeResponse> {
  return sendNativeEnvelope({ kind: 'browser_event', payload: { type: 'copy_binding_requested', ...payload } });
}

export async function sendArtifactBound(payload: any): Promise<NativeBridgeResponse> {
  return sendNativeEnvelope({ kind: 'browser_event', payload: { type: 'artifact_bound', ...payload } });
}

export async function sendCopilotCandidateLookup(payload: {
  project_id: string;
  session_id?: string;
  text_hash: string;
  normalized_length: number;
  excerpt: string;
  captured_at: string;
}): Promise<NativeBridgeResponse> {
  return sendNativeEnvelope({ kind: 'browser_event', payload: { type: 'copilot_candidate_lookup_query', ...payload } });
}

export async function getBootstrapAuthority(): Promise<{
  project_id: string;
  project_label: string;
  authority: string;
  timestamp: string;
  session_id?: string | null;
  dispatch_id?: string | null;
} | null> {
  try {
    const response = await sendNativeEnvelope({ payload: { type: 'get_bootstrap_authority', message_id: `msg_bootstrap_query_${Date.now()}` } }) as any;
    if (response?.type === 'bootstrap_authority' && response?.project_id) {
      return {
        project_id: response.project_id,
        project_label: response.project_label,
        authority: response.authority,
        timestamp: response.timestamp,
        session_id: response.session_id || null,
        dispatch_id: response.dispatch_id || null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function onBootstrapAuthorityPush(listener: (payload: BootstrapAuthorityPayload) => void): () => void {
  bootstrapAuthorityListeners.add(listener);
  console.log('[SignalForge] bootstrap authority push listener registered', { listeners: bootstrapAuthorityListeners.size });
  return () => {
    bootstrapAuthorityListeners.delete(listener);
    console.log('[SignalForge] bootstrap authority push listener removed', { listeners: bootstrapAuthorityListeners.size });
  };
}

export async function ensureNativeBridgeConnected(): Promise<void> {
  try {
    await connectNativePort();
  } catch {
    // Best-effort connection setup; fallback query still recovers authority.
  }
}

export function getBridgeStatus() {
  return {
    connected: !!nativePort,
    lastError: lastBridgeError,
  };
}

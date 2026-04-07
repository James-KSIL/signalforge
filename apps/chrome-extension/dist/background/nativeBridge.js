const NATIVE_HOST_NAMES = ['com.signalforge.host', 'com.signalforge.nativehost'];
let nativePort = null;
let connectPromise = null;
const pendingRequests = new Map();
let lastBridgeError = null;
let nativePortDisconnected = false;
const bootstrapAuthorityListeners = new Set();
function messageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function setBridgeBadge(text, title) {
    try {
        chrome.action.setBadgeText({ text });
        if (title)
            chrome.action.setTitle({ title });
    }
    catch {
        // ignore badge failures in environments without action UI
    }
}
function clearBridgeBadge() {
    try {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setTitle({ title: 'SignalForge Chat Capture' });
    }
    catch {
        // ignore badge failures in environments without action UI
    }
}
function rejectPendingRequests(error) {
    for (const [id, pending] of pendingRequests.entries()) {
        pending.reject(new Error(error));
        pendingRequests.delete(id);
    }
}
function markPortDisconnected(error) {
    nativePort = null;
    connectPromise = null;
    nativePortDisconnected = true;
    setBridgeFailure(error);
    rejectPendingRequests(error);
}
function setBridgeFailure(error) {
    lastBridgeError = error;
    setBridgeBadge('!', error);
}
function clearBridgeFailure() {
    lastBridgeError = null;
    clearBridgeBadge();
}
function hasInvalidProjectId(responseData) {
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
function notifyBootstrapAuthorityListeners(responseData) {
    if (responseData?.type !== 'bootstrap_authority' || !responseData?.project_id) {
        return;
    }
    const payload = {
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
        }
        catch {
            // Listener failures must not break bridge message handling.
        }
    }
}
function connectNativePort() {
    if (nativePort && !nativePortDisconnected)
        return Promise.resolve(nativePort);
    if (connectPromise)
        return connectPromise;
    connectPromise = new Promise((resolve, reject) => {
        try {
            console.log('[SignalForge] connecting native bridge', { hosts: NATIVE_HOST_NAMES });
            let port = null;
            let lastConnectError = null;
            for (const hostName of NATIVE_HOST_NAMES) {
                try {
                    port = chrome.runtime.connectNative(hostName);
                    if (port)
                        break;
                }
                catch (error) {
                    lastConnectError = error;
                }
            }
            if (!port) {
                throw (lastConnectError || new Error('SignalForge local bridge unavailable'));
            }
            nativePort = port;
            nativePortDisconnected = false;
            port.onMessage.addListener((response) => {
                const data = response;
                if (!data || typeof data.project_id !== 'string' || data.project_id.trim().length === 0) {
                    return;
                }
                const responseData = data;
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
                    pending.resolve(responseData.type ? responseData : { type: 'ack', message_id: messageId, status: 'accepted' });
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
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            setBridgeFailure(reason);
            reject(error);
        }
    }).finally(() => {
        connectPromise = null;
    });
    return connectPromise;
}
async function sendNativeEnvelope(message) {
    const port = await connectNativePort();
    const message_id = typeof message.message_id === 'string' && message.message_id.trim().length > 0
        ? message.message_id
        : messageId();
    const request = { ...message, message_id };
    const responsePromise = new Promise((resolve, reject) => {
        pendingRequests.set(message_id, { resolve, reject });
    });
    try {
        if (!port) {
            throw new Error(lastBridgeError || 'SignalForge local bridge unavailable');
        }
        port.postMessage(request);
    }
    catch (error) {
        pendingRequests.delete(message_id);
        const reason = error instanceof Error ? error.message : String(error);
        markPortDisconnected(reason || 'SignalForge local bridge unavailable');
        return Promise.reject(new Error(reason || 'SignalForge local bridge unavailable'));
    }
    return responsePromise;
}
export async function sendBrowserEvent(message) {
    return sendNativeEnvelope(message);
}
export async function sendCopyBindingRequested(payload) {
    return sendNativeEnvelope({ kind: 'browser_event', payload: { type: 'copy_binding_requested', ...payload } });
}
export async function sendArtifactBound(payload) {
    return sendNativeEnvelope({ kind: 'browser_event', payload: { type: 'artifact_bound', ...payload } });
}
export async function sendCopilotCandidateLookup(payload) {
    return sendNativeEnvelope({ kind: 'browser_event', payload: { type: 'copilot_candidate_lookup_query', ...payload } });
}
export async function getBootstrapAuthority() {
    try {
        const response = await sendNativeEnvelope({ payload: { type: 'get_bootstrap_authority', message_id: `msg_bootstrap_query_${Date.now()}` } });
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
    }
    catch {
        return null;
    }
}
export function onBootstrapAuthorityPush(listener) {
    bootstrapAuthorityListeners.add(listener);
    console.log('[SignalForge] bootstrap authority push listener registered', { listeners: bootstrapAuthorityListeners.size });
    return () => {
        bootstrapAuthorityListeners.delete(listener);
        console.log('[SignalForge] bootstrap authority push listener removed', { listeners: bootstrapAuthorityListeners.size });
    };
}
export async function ensureNativeBridgeConnected() {
    try {
        await connectNativePort();
    }
    catch {
        // Best-effort connection setup; fallback query still recovers authority.
    }
}
export function getBridgeStatus() {
    return {
        connected: !!nativePort,
        lastError: lastBridgeError,
    };
}

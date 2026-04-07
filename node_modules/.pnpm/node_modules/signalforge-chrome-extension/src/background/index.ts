import { BindingState } from './bindingState.js';
import {
  sendArtifactBound,
  sendBrowserEvent,
  sendCopilotCandidateLookup,
  sendCopyBindingRequested,
  getBridgeStatus,
  getBootstrapAuthority,
  ensureNativeBridgeConnected,
  onBootstrapAuthorityPush,
} from './nativeBridge.js';

const bindingState = new BindingState();
void bindingState.whenReady();

let awaitingDispatchThreads = new Set<string>();

const CHATGPT_URL_PATTERNS = ['https://chat.openai.com/*', 'https://chatgpt.com/*'];

function reinjectContentScriptForOpenTabs(reason: 'startup' | 'installed' | 'update'): void {
  chrome.tabs.query({ url: CHATGPT_URL_PATTERNS }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.log('[SignalForge] content reinjection query failed', {
        reason,
        error: chrome.runtime.lastError.message,
      });
      return;
    }

    for (const tab of tabs || []) {
      if (!tab.id) continue;
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ['dist/content/content.bundle.js'],
        },
        () => {
          const error = chrome.runtime.lastError;
          if (error) {
            console.log('[SignalForge] content reinjection skipped', {
              reason,
              tabId: tab.id,
              error: error.message,
            });
          } else {
            console.log('[SignalForge] content script reinjected', {
              reason,
              tabId: tab.id,
            });
          }
        }
      );
    }
  });
}

chrome.runtime.onStartup.addListener(() => {
  reinjectContentScriptForOpenTabs('startup');
});

chrome.runtime.onInstalled.addListener((_details) => {
  reinjectContentScriptForOpenTabs('installed');
});

async function persistBootstrapAuthority(payload: {
  project_id: string;
  project_label: string;
  authority: string;
  session_id?: string | null;
  dispatch_id?: string | null;
}): Promise<void> {
  console.log('[SignalForge] persisting bootstrap authority to chrome storage', {
    active_project_id: payload.project_id,
    active_project_label: payload.project_label,
    active_project_authority: payload.authority,
    active_session_id: payload.session_id || null,
    active_dispatch_id: payload.dispatch_id || null,
  });

  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set(
      {
        active_project_id: payload.project_id,
        active_project_label: payload.project_label,
        active_project_authority: payload.authority,
        active_session_id: payload.session_id || null,
        active_dispatch_id: payload.dispatch_id || null,
      },
      () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      }
    );
  });

  const persisted = await chrome.storage.local.get(['active_project_id', 'active_project_label', 'active_project_authority']);
  console.log('[SignalForge] active project authority verified in chrome storage', persisted);

  console.log('[SignalForge] active project authority persisted to chrome storage', {
    active_project_id: payload.project_id,
    active_project_label: payload.project_label,
    active_project_authority: payload.authority,
    active_session_id: payload.session_id || null,
    active_dispatch_id: payload.dispatch_id || null,
  });
}

onBootstrapAuthorityPush((payload) => {
  console.log('[SignalForge] bootstrap authority received via push', { project_id: payload.project_id, authority: payload.authority });
  void persistBootstrapAuthority(payload)
    .catch((err: any) => {
      console.log('[SignalForge] failed to persist pushed bootstrap authority:', String(err));
    });
});

void ensureNativeBridgeConnected();

// Fallback: Initialize bootstrap authority on extension startup (recovery path)
// Primary path: receives bootstrap authority via push event (see port.onMessage handler below)
async function initializeBootstrapAuthority(): Promise<void> {
  try {
    console.log('[SignalForge] bootstrap authority fallback query started');
    const authority = await getBootstrapAuthority();
    if (authority && authority.project_id) {
      console.log('[SignalForge] bootstrap authority restored via fallback', { project_id: authority.project_id, authority: authority.authority });
      await persistBootstrapAuthority(authority);
      return;
    }

    console.log('[SignalForge] bootstrap authority fallback query returned empty result');
  } catch (err: any) {
    console.log('[SignalForge] fallback authority recovery failed:', String(err));
  }
}

// Trigger fallback query on extension init
void initializeBootstrapAuthority();


chrome.runtime.onMessage.addListener((msg: any, sender, sendResponse) => {
  if (!msg) return;

  // handle explicit awaiting_dispatch signal from content script
  if (msg.type === 'awaiting_dispatch' && msg.chatThreadId) {
    awaitingDispatchThreads.add(msg.chatThreadId);
    return;
  }

  if (msg.type === 'copy_binding_requested' && msg.payload) {
    const copyEvent = msg.payload as any;
    console.log('[SignalForge] copy_binding_requested received', {
      source: sender?.url || sender?.origin || 'unknown',
      chat_id: copyEvent?.chat_id || null,
      project_id: copyEvent?.project_id || null,
      selection_type: copyEvent?.selection_type || null,
    });

    if (!String(copyEvent.project_id || '').trim()) {
      console.log('[SignalForge] No active project pinned in VS Code; copy event not dispatched');
      sendResponse?.({ ok: false, error: 'active_project_id is required.' });
      return false;
    }

    bindingState.storePendingBinding(copyEvent, [], undefined);
    console.log('[SignalForge] forwarding copy_binding_requested to native host', {
      chat_id: copyEvent?.chat_id || null,
      project_id: copyEvent?.project_id || null,
    });
    void sendCopyBindingRequested(copyEvent)
      .then((response) => {
        console.log('[SignalForge] copy_binding_requested native host response', {
          type: (response as any)?.type || null,
          message_id: (response as any)?.message_id || null,
          status: (response as any)?.status || null,
          reason: (response as any)?.reason || null,
        });
        sendResponse?.({ ok: true, response });
      })
      .catch((error: any) => {
        console.log('[SignalForge] copy_binding_requested native host error', {
          error: String(error),
          chat_id: copyEvent?.chat_id || null,
          project_id: copyEvent?.project_id || null,
        });
        sendResponse?.({ ok: false, error: String(error) });
      });
    return true;
  }

  if (msg.type === 'copilot_candidate_captured' && msg.payload) {
    void sendBrowserEvent({
      kind: 'browser_event',
      payload: {
        type: 'copilot_candidate_captured',
        ...msg.payload,
      },
    })
      .then((response) => sendResponse?.({ ok: true, response }))
      .catch((error: any) => sendResponse?.({ ok: false, error: String(error) }));
    return true;
  }

  if (msg.type === 'lookup_copilot_candidate' && msg.payload) {
    void sendCopilotCandidateLookup(msg.payload)
      .then((response) => sendResponse?.({ ok: true, response }))
      .catch((error: any) => sendResponse?.({ ok: false, error: String(error) }));
    return true;
  }

  if (msg.type === 'confirm_binding') {
    void bindingState.whenReady().then(async () => {
      const pending = bindingState.getPendingBinding(msg.chat_id);
      if (!pending) {
        sendResponse?.({ ok: false, error: 'No pending binding found.' });
        return;
      }

      const projectId = String(msg.project_id || '').trim();
      if (!projectId) {
        sendResponse?.({ ok: false, error: 'project_id is required.' });
        return;
      }

      const selectedProject = {
        project_id: projectId,
        label: msg.project_label || projectId,
        authority: msg.authority || 'manual_selection',
        workspace_root: msg.workspace_root || undefined,
        expires_at: msg.expires_at || undefined,
      };

      await new Promise<void>((resolve) => {
        chrome.storage.local.set(
          {
            active_project_id: selectedProject.project_id,
            active_project_label: selectedProject.label,
            active_project_authority: selectedProject.authority,
          },
          () => resolve()
        );
      });

      console.log('[SignalForge] active_project_id stored', {
        active_project_id: selectedProject.project_id,
        active_project_label: selectedProject.label,
        active_project_authority: selectedProject.authority,
      });

      const artifactEvent = bindingState.createBoundArtifactEvent(pending, selectedProject as any);
      void sendArtifactBound(artifactEvent)
        .then((response) => {
          bindingState.clearPendingBinding(msg.chat_id);
          sendResponse?.({ ok: true, response, event: artifactEvent });
        })
        .catch((error: any) => {
          sendResponse?.({ ok: false, error: String(error) });
        });
    });
    return true;
  }

  if (msg.type === 'get_binding_state') {
    void bindingState.whenReady().then(() => {
      const pendingBindings = Array.from(bindingState.getAllPendingBindings().values()).map((binding) => ({
        chat_id: binding.copyEvent.chat_id,
        copied_text: binding.copyEvent.copied_text,
        selection_type: binding.copyEvent.selection_type,
        source_url: binding.copyEvent.source_url,
        created_at: binding.copyEvent.created_at,
        reason: binding.reason,
        has_expired: binding.hasExpired,
        expiration_notice: binding.expirationNotice,
        candidates: binding.candidates,
        preselected_project: binding.preselectedProject,
      }));

      sendResponse({ pendingBindings, bridge: getBridgeStatus() });
    });
    return;
  }

  // status query
  if (msg && msg.type === 'get_status') {
    sendResponse({ native: 'unknown', awaitingDispatch: Array.from(awaitingDispatchThreads), bridge: getBridgeStatus(), pendingBindings: Array.from(bindingState.getAllPendingBindings().keys()) });
    return;
  }

  // handle browser_event payloads
  if (msg.kind === 'browser_event' && msg.payload) {
    const p = msg.payload as any;
    // if this is an assistant turn and thread is awaiting, create a dispatch_candidate_created event once
    if (p.type === 'chat_turn_completed' && p.role === 'assistant') {
      if (awaitingDispatchThreads.has(p.chatThreadId)) {
        const candidate = {
          type: 'dispatch_candidate_created',
          eventId: p.eventId || `${p.chatThreadId}:${p.turnIndex}:candidate`,
          chatThreadId: p.chatThreadId,
          sourceUrl: p.sourceUrl,
          turnIndex: p.turnIndex,
          content: p.content,
          createdAt: p.createdAt
        };
        void sendBrowserEvent({ kind: 'browser_event', payload: candidate });
        awaitingDispatchThreads.delete(p.chatThreadId);
        // still forward the original assistant turn as well
        void sendBrowserEvent(msg);
        return;
      }
    }

    // default forwarding for other events
    void sendBrowserEvent(msg);
    return;
  }
});

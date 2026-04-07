type BindingStateResponse = {
  pendingBindings?: Array<{
    chat_id: string;
    copied_text: string;
    selection_type: string;
    source_url: string;
    created_at: string;
    reason: string;
    has_expired?: boolean;
    expiration_notice?: string;
  }>;
  bridge?: { connected: boolean; lastError: string | null };
  awaitingDispatch?: string[];
};

function sendMessage<T>(message: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response as T);
    });
  });
}

function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, textContent?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
}

function render() {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = '';

  const title = createElement('h3', 'sf-title', 'SignalForge');
  const status = createElement('div', 'sf-status', 'Loading...');
  const content = createElement('div', 'sf-content');
  root.append(title, status, content);

  const refresh = async () => {
    try {
      const response = await sendMessage<BindingStateResponse>({ type: 'get_binding_state' });
      const statusResponse = await sendMessage<BindingStateResponse>({ type: 'get_status' });

      const bridge = response.bridge || statusResponse.bridge;
      const awaiting = statusResponse.awaitingDispatch?.length || 0;
      const pendingBindings = response.pendingBindings || [];

      status.textContent = bridge?.connected
        ? `Bridge connected · ${awaiting} awaiting dispatch thread(s)`
        : `Bridge unavailable · ${awaiting} awaiting dispatch thread(s)`;

      content.innerHTML = '';

      if (bridge?.lastError) {
        const error = createElement('div', 'sf-error', bridge.lastError);
        content.append(error);
      }

      if (pendingBindings.length === 0) {
        content.append(createElement('div', 'sf-empty', 'No pending copy bindings.'));
        return;
      }

      for (const pending of pendingBindings) {
        const card = createElement('section', 'sf-card');
        const header = createElement('div', 'sf-card-header', pending.chat_id);
        const reason = createElement('div', 'sf-reason', pending.reason);
        const preview = createElement('pre', 'sf-preview', pending.copied_text.slice(0, 500));
        const meta = createElement('div', 'sf-meta', `${pending.selection_type} · ${pending.source_url}`);
        const form = createElement('div', 'sf-form');

        const projectInput = document.createElement('input');
        projectInput.type = 'text';
        projectInput.placeholder = 'project_id';
        projectInput.className = 'sf-input';

        const authoritySelect = document.createElement('select');
        authoritySelect.className = 'sf-input';
        for (const authority of ['pinned_project', 'manual_selection', 'active_workspace', 'recent_project']) {
          const option = document.createElement('option');
          option.value = authority;
          option.textContent = authority;
          if (authority === 'manual_selection') option.selected = true;
          authoritySelect.append(option);
        }

        const button = document.createElement('button');
        button.textContent = 'Bind to project';
        button.className = 'sf-button';
        button.onclick = async () => {
          const projectId = projectInput.value.trim();
          if (!projectId) {
            status.textContent = 'Enter a project_id before binding.';
            return;
          }

          button.disabled = true;
          try {
            const result = await sendMessage<{ ok: boolean; error?: string }>({
              type: 'confirm_binding',
              chat_id: pending.chat_id,
              project_id: projectId,
              authority: authoritySelect.value,
              project_label: projectId,
            });

            if (!result.ok) {
              status.textContent = result.error || 'Failed to bind artifact.';
              return;
            }

            status.textContent = 'Artifact bound and acknowledged.';
            await refresh();
          } catch (error: any) {
            status.textContent = String(error);
          } finally {
            button.disabled = false;
          }
        };

        form.append(projectInput, authoritySelect, button);
        card.append(header, reason, meta, preview, form);
        content.append(card);
      }
    } catch (error: any) {
      status.textContent = String(error);
    }
  };

  void refresh();
}

document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    :root { color-scheme: light; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: linear-gradient(180deg, #f7fafc 0%, #eef2ff 100%); color: #111827; }
    #root { width: 360px; padding: 16px; box-sizing: border-box; }
    .sf-title { margin: 0 0 8px; font-size: 18px; letter-spacing: -0.02em; }
    .sf-status { margin-bottom: 12px; font-size: 12px; color: #374151; }
    .sf-content { display: flex; flex-direction: column; gap: 12px; }
    .sf-card { border: 1px solid rgba(15, 23, 42, 0.12); border-radius: 12px; padding: 12px; background: rgba(255,255,255,0.88); box-shadow: 0 10px 30px rgba(15,23,42,0.08); }
    .sf-card-header { font-weight: 600; margin-bottom: 4px; }
    .sf-reason { font-size: 12px; color: #7c3aed; margin-bottom: 8px; }
    .sf-meta { font-size: 11px; color: #6b7280; margin-bottom: 8px; }
    .sf-preview { white-space: pre-wrap; max-height: 140px; overflow: auto; margin: 0 0 10px; padding: 10px; border-radius: 8px; background: #f8fafc; border: 1px solid #e5e7eb; font-size: 11px; line-height: 1.45; }
    .sf-form { display: grid; gap: 8px; }
    .sf-input, .sf-button { width: 100%; box-sizing: border-box; border-radius: 8px; font-size: 12px; }
    .sf-input { border: 1px solid #d1d5db; padding: 8px 10px; background: white; }
    .sf-button { border: none; padding: 9px 10px; background: #111827; color: white; font-weight: 600; cursor: pointer; }
    .sf-button:disabled { opacity: 0.6; cursor: progress; }
    .sf-empty { padding: 12px; border: 1px dashed #cbd5e1; border-radius: 10px; color: #64748b; font-size: 12px; background: rgba(255,255,255,0.8); }
    .sf-error { padding: 10px 12px; border-radius: 10px; margin-bottom: 12px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 12px; }
  `;
  document.head.append(style);
  render();
});

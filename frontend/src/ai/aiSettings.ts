import type { AppState } from '@/store';

/**
 * AI > Settings: the backend URL and an optional model name. The model is sent as the
 * `X-Riffspaced-Model` header and honored only when the backend allows overrides
 * (RIFFSPACED_ALLOW_MODEL_OVERRIDE=1), so the dialog says so.
 */
export function openAiSettings(s: AppState): void {
  s.openDialog({
    kind: 'form',
    title: 'AI settings',
    message:
      'The backend URL is polled every 15 s. A model name is sent with every AI request and used only if the backend allows overrides.',
    fields: [
      { name: 'url', label: 'backend URL', type: 'text', value: s.backend.url },
      { name: 'model', label: 'model (blank = server default)', type: 'text', value: s.ai.model },
    ],
    confirmLabel: 'save',
    onConfirm: (values) => {
      const url = String(values.url ?? '').trim();
      if (url && url !== s.backend.url) s.setBackendUrl(url);
      s.setAiModel(String(values.model ?? ''));
    },
  });
}

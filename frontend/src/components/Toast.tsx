import { useEffect } from 'react';
import { useStore } from '@/store';
import './toast.css';

export const TOAST_MS = 3000;

/** Non-blocking status messages, bottom right, auto-dismissed. */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => window.setTimeout(() => dismiss(t.id), TOAST_MS));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, dismiss]);
  if (!toasts.length) return null;
  return (
    <div className="toasts" data-testid="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import './dialog.css';

/**
 * The one modal (SPEC 5.7). Renders the store's current DialogSpec. Enter confirms,
 * Escape cancels, focus lands on the confirm button. Never a browser dialog.
 */
export function Dialog() {
  const dialog = useStore((s) => s.dialog);
  const confirm = useStore((s) => s.confirmDialog);
  const cancel = useStore((s) => s.cancelDialog);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dialog) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        confirm();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, confirm, cancel]);

  if (!dialog) return null;
  return (
    <div className="dialog-backdrop" data-testid="dialog" onClick={cancel}>
      <div
        className={dialog.danger ? 'dialog dialog--danger' : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title" className="dialog__title">
          {dialog.title}
        </h2>
        <p className="dialog__message">{dialog.message}</p>
        <div className="dialog__buttons">
          <button type="button" onClick={cancel}>
            {dialog.cancelLabel ?? 'cancel'}
          </button>
          <button type="button" ref={confirmRef} className="dialog__confirm" onClick={confirm}>
            {dialog.confirmLabel ?? 'ok'}
          </button>
        </div>
      </div>
    </div>
  );
}

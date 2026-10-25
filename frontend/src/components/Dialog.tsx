import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import type { DialogSpec, FormField, FormValues } from '@/store/dialogSlice';
import './dialog.css';

/**
 * The one modal (SPEC 5.7). Renders the store's current DialogSpec: confirm, prompt, form,
 * or info. Enter confirms, Escape cancels. Never a browser dialog.
 *
 * Each dialog instance gets its own DialogView (keyed by instance), so field state starts
 * from the spec's defaults without an effect that calls setState.
 */
const instanceIds = new WeakMap<DialogSpec, number>();
let nextInstance = 1;
function instanceId(spec: DialogSpec): number {
  let id = instanceIds.get(spec);
  if (!id) {
    id = nextInstance++;
    instanceIds.set(spec, id);
  }
  return id;
}

export function Dialog() {
  const dialog = useStore((s) => s.dialog);
  if (!dialog) return null;
  return <DialogView key={instanceId(dialog)} dialog={dialog} />;
}

function DialogView({ dialog }: { dialog: DialogSpec }) {
  const confirm = useStore((s) => s.confirmDialog);
  const cancel = useStore((s) => s.cancelDialog);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(dialog.kind === 'prompt' ? (dialog.defaultValue ?? '') : '');
  const [values, setValues] = useState<FormValues>(() =>
    dialog.kind === 'form' ? Object.fromEntries(dialog.fields.map((f) => [f.name, f.value])) : {},
  );

  useEffect(() => {
    const focusTarget =
      dialog.kind === 'prompt' || dialog.kind === 'form'
        ? firstFieldRef.current
        : confirmRef.current;
    focusTarget?.focus();
    if (focusTarget instanceof HTMLInputElement && focusTarget.type === 'text')
      focusTarget.select();
  }, [dialog]);

  const submit = () => {
    if (dialog.kind === 'prompt') confirm(text);
    else if (dialog.kind === 'form') confirm(values);
    else confirm();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        submit();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // submit closes over text and values; re-binding on every render is the simple route.
  });

  const danger = dialog.kind === undefined || dialog.kind === 'confirm' ? dialog.danger : false;

  const renderField = (f: FormField, i: number) => {
    const value = values[f.name] ?? f.value;
    const set = (v: string | number | boolean) => setValues((prev) => ({ ...prev, [f.name]: v }));
    const ref = i === 0 ? firstFieldRef : undefined;
    if (f.type === 'select') {
      return (
        <select value={String(value)} onChange={(e) => set(e.target.value)}>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    if (f.type === 'checkbox') {
      return (
        <input
          ref={ref}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => set(e.target.checked)}
        />
      );
    }
    if (f.type === 'number') {
      return (
        <input
          ref={ref}
          type="number"
          min={f.min}
          max={f.max}
          value={Number(value)}
          onChange={(e) => set(Number(e.target.value))}
        />
      );
    }
    return (
      <input ref={ref} type="text" value={String(value)} onChange={(e) => set(e.target.value)} />
    );
  };

  return (
    <div className="dialog-backdrop" data-testid="dialog" onClick={cancel}>
      <div
        className={danger ? 'dialog dialog--danger' : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title" className="dialog__title">
          {dialog.title}
        </h2>
        {dialog.message ? <p className="dialog__message">{dialog.message}</p> : null}

        {dialog.kind === 'prompt' ? (
          <input
            ref={firstFieldRef}
            className="dialog__input"
            type="text"
            aria-label={dialog.title}
            placeholder={dialog.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        ) : null}

        {dialog.kind === 'form' ? (
          <div className="dialog__form">
            {dialog.fields.map((f, i) => (
              <label key={f.name} className="dialog__field">
                <span>{f.label}</span>
                {renderField(f, i)}
              </label>
            ))}
          </div>
        ) : null}

        {dialog.kind === 'info' && dialog.table ? (
          <table className="dialog__table">
            <thead>
              <tr>
                {dialog.table.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dialog.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="dialog__buttons">
          {dialog.kind !== 'info' ? (
            <button type="button" onClick={cancel}>
              {dialog.cancelLabel ?? 'cancel'}
            </button>
          ) : null}
          <button type="button" ref={confirmRef} className="dialog__confirm" onClick={submit}>
            {dialog.confirmLabel ?? 'ok'}
          </button>
        </div>
      </div>
    </div>
  );
}

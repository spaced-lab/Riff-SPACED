import type { StateCreator } from 'zustand';
import type { AppState } from './types';

/**
 * One themed modal at a time (SPEC 5.7: never window.confirm, alert or prompt, they block
 * the Chrome extension used for testing). The dialog is store state so any action can ask
 * a question and tests can answer it. Four kinds: confirm, prompt (one text field), form
 * (several fields), info (text and an optional table).
 */
export type FormField = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  value: string | number | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};

export type FormValues = Record<string, string | number | boolean>;

export type DialogSpec =
  | {
      kind?: 'confirm';
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
      onConfirm: () => void;
      onCancel?: () => void;
    }
  | {
      kind: 'prompt';
      title: string;
      message?: string;
      defaultValue?: string;
      placeholder?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm: (value: string) => void;
      onCancel?: () => void;
    }
  | {
      kind: 'form';
      title: string;
      message?: string;
      fields: FormField[];
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm: (values: FormValues) => void;
      onCancel?: () => void;
    }
  | {
      kind: 'info';
      title: string;
      message?: string;
      table?: { headers: string[]; rows: string[][] };
      confirmLabel?: string;
      onConfirm?: () => void;
    };

export type Toast = { id: number; text: string; kind: 'info' | 'warn' | 'error' };

export type DialogSlice = {
  dialog: DialogSpec | null;
  openDialog: (spec: DialogSpec) => void;
  /** Answer the dialog: a string for prompt, values for form, nothing otherwise. */
  confirmDialog: (payload?: string | FormValues) => void;
  cancelDialog: () => void;
  /** File > Import from audio dialog (its own component, not a DialogSpec). */
  importDialogOpen: boolean;
  setImportDialogOpen: (open: boolean) => void;
  /** Tuning > Find easier tuning dialog (its own component). */
  easierTuningOpen: boolean;
  setEasierTuningOpen: (open: boolean) => void;
  toasts: Toast[];
  /** Non-blocking status that disappears on its own. */
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
};

let nextToastId = 1;

export const createDialogSlice: StateCreator<AppState, [], [], DialogSlice> = (set, get) => ({
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  confirmDialog: (payload) => {
    const d = get().dialog;
    set({ dialog: null });
    if (!d) return;
    if (d.kind === 'prompt')
      d.onConfirm(typeof payload === 'string' ? payload : (d.defaultValue ?? ''));
    else if (d.kind === 'form')
      d.onConfirm(
        typeof payload === 'object' && payload
          ? payload
          : Object.fromEntries(d.fields.map((f) => [f.name, f.value])),
      );
    else if (d.kind === 'info') d.onConfirm?.();
    else d.onConfirm();
  },
  cancelDialog: () => {
    const d = get().dialog;
    set({ dialog: null });
    if (d && d.kind !== 'info') d.onCancel?.();
  },
  importDialogOpen: false,
  setImportDialogOpen: (importDialogOpen) => set({ importDialogOpen }),
  easierTuningOpen: false,
  setEasierTuningOpen: (easierTuningOpen) => set({ easierTuningOpen }),
  toasts: [],
  toast: (text, kind = 'info') => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
});

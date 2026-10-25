import type { StateCreator } from 'zustand';
import type { AppState } from './types';

/**
 * One themed modal at a time (SPEC 5.7: never window.confirm or alert, they block the
 * Chrome extension used for testing). The dialog is store state so any action can ask a
 * question and tests can answer it.
 */
export type DialogSpec = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

export type DialogSlice = {
  dialog: DialogSpec | null;
  openDialog: (spec: DialogSpec) => void;
  confirmDialog: () => void;
  cancelDialog: () => void;
};

export const createDialogSlice: StateCreator<AppState, [], [], DialogSlice> = (set, get) => ({
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  confirmDialog: () => {
    const d = get().dialog;
    set({ dialog: null });
    d?.onConfirm();
  },
  cancelDialog: () => {
    const d = get().dialog;
    set({ dialog: null });
    d?.onCancel?.();
  },
});

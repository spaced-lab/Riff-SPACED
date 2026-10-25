import type { StateCreator } from 'zustand';
import type { LibraryBundle } from '@/model/types';
import { jsonBlob, openFiles, saveFile } from '@/storage/files';
import { ensureWritable, recallHandle, rememberHandle } from '@/storage/handles';
import {
  duplicateIds,
  fileNameFor,
  itemsOf,
  mergeIntoLibrary,
  parseDocument,
} from '@/storage/documents';
import type { ParsedDocument } from '@/storage/documents';
import { pushRecent, readRecent } from '@/storage/recent';
import { riffToTextTab } from '@/export/texttab';
import { midiBlob } from '@/export/midi';
import { selectDisplayRiff } from './derived';
import type { RecentEntry } from '@/storage/recent';
import { bundleToSave } from './librarySlice';
import type { AppState } from './types';

/**
 * File menu actions (P5.T4). Each one is async and reports through toasts and dialogs; the
 * store keeps the file handle of the current item so plain Save can overwrite in Chrome.
 */
export type FileSlice = {
  /** File handles by item id (File System Access only; empty elsewhere). */
  fileHandles: Record<string, FileSystemFileHandle>;
  /** Display names of the files behind items, for the status bar. */
  fileNames: Record<string, string>;
  recent: RecentEntry[];
  openFromDisk: () => Promise<void>;
  saveCurrent: (options?: { saveAs?: boolean }) => Promise<void>;
  exportLibrary: () => Promise<void>;
  importLibrary: () => Promise<void>;
  /** Import an already-parsed document (used by open, import, and tests). */
  importDocument: (doc: ParsedDocument, sourceName: string) => void;
  loadRecent: () => void;
  /** File > Export > Text tab: downloads <name>.tab.txt of the riff on screen (flattened for arrangements). */
  exportTextTab: () => Promise<void>;
  /** Edit > Copy as text tab: system clipboard, with a toast. */
  copyTextTab: () => Promise<void>;
  /** File > Export > MIDI: asks about channel-per-string, then downloads <name>.mid. */
  exportMidi: () => void;
};

export const createFileSlice: StateCreator<AppState, [], [], FileSlice> = (set, get) => ({
  fileHandles: {},
  fileNames: {},
  recent: [],

  loadRecent: () => set({ recent: readRecent() }),

  exportTextTab: async () => {
    get().syncCurrentRiff();
    const riff = selectDisplayRiff(get()).riff;
    const text = riffToTextTab(riff);
    const name = `${fileNameFor({ kind: 'riff', value: riff }).replace(/\.riff\.json$/, '')}.tab.txt`;
    const result = await saveFile(new Blob([text], { type: 'text/plain' }), name, {
      forceAsk: true,
    });
    if (result) get().toast(`exported ${result.name}`);
  },

  exportMidi: () => {
    get().syncCurrentRiff();
    const riff = selectDisplayRiff(get()).riff;
    get().openDialog({
      kind: 'form',
      title: 'export MIDI',
      message: `${riff.name}: format 0, 480 PPQ, program 30 (distortion guitar).`,
      fields: [
        {
          name: 'channelPerString',
          label: 'one channel per string',
          type: 'checkbox',
          value: false,
        },
      ],
      confirmLabel: 'export',
      onConfirm: (values) => {
        const name = `${fileNameFor({ kind: 'riff', value: riff }).replace(/\.riff\.json$/, '')}.mid`;
        void saveFile(
          midiBlob(riff, { channelPerString: Boolean(values.channelPerString) }),
          name,
          { forceAsk: true },
        ).then((result) => {
          if (result) get().toast(`exported ${result.name}`);
        });
      },
    });
  },

  copyTextTab: async () => {
    get().syncCurrentRiff();
    const text = riffToTextTab(selectDisplayRiff(get()).riff);
    try {
      await navigator.clipboard.writeText(text);
      get().toast('text tab copied to the clipboard');
    } catch {
      get().openDialog({ kind: 'info', title: 'text tab', message: text, confirmLabel: 'close' });
    }
  },

  openFromDisk: async () => {
    const files = await openFiles({ multiple: true });
    for (const file of files) {
      const parsed = parseDocument(file.text);
      if (!parsed.ok) {
        get().openDialog({
          kind: 'info',
          title: `could not open ${file.name}`,
          message: parsed.errors.slice(0, 8).join('\n'),
          confirmLabel: 'close',
        });
        continue;
      }
      get().importDocument(parsed.doc, file.name);
      if (file.handle && parsed.doc.kind !== 'library') {
        const id = parsed.doc.value.id;
        set((s) => ({
          fileHandles: { ...s.fileHandles, [id]: file.handle! },
          fileNames: { ...s.fileNames, [id]: file.name },
        }));
        void rememberHandle(id, file.handle);
      }
    }
  },

  importDocument: (doc, sourceName) => {
    const s = get();
    s.syncCurrentRiff();
    const incoming = itemsOf(doc);
    const dupes = duplicateIds(get().library, incoming);
    const finish = (library: LibraryBundle, mode: 'replace' | 'keepBoth' | 'none') => {
      set({ library });
      if (doc.kind === 'riff') {
        const id = mode === 'keepBoth' ? library.riffs[library.riffs.length - 1]!.id : doc.value.id;
        set({ currentRiffId: null });
        get().openRiff(id);
        get().markRiffClean(id);
      } else if (doc.kind === 'arrangement') get().openArrangement(doc.value.id);
      else if (doc.kind === 'song') get().openSong(doc.value.id);
      const count = incoming.riffs.length + incoming.arrangements.length + incoming.songs.length;
      get().toast(`imported ${count} item${count === 1 ? '' : 's'} from ${sourceName}`);
      set({
        recent: pushRecent({
          name: sourceName,
          kind: doc.kind,
          id: doc.kind === 'library' ? sourceName : doc.value.id,
        }),
      });
    };
    if (dupes.length === 0) {
      finish(mergeIntoLibrary(get().library, incoming, 'replace'), 'none');
      return;
    }
    get().openDialog({
      title: 'already in the library',
      message: `${dupes.length} item${dupes.length === 1 ? ' has' : 's have'} the same id as something already here. Replace the existing copies, or keep both?`,
      confirmLabel: 'replace',
      cancelLabel: 'keep both',
      onConfirm: () => finish(mergeIntoLibrary(get().library, incoming, 'replace'), 'replace'),
      onCancel: () => finish(mergeIntoLibrary(get().library, incoming, 'keepBoth'), 'keepBoth'),
    });
  },

  saveCurrent: async (options = {}) => {
    const s = get();
    s.syncCurrentRiff();
    const state = get();
    let doc: ParsedDocument | null = null;
    if (state.editing === 'riff') doc = { kind: 'riff', value: state.riff };
    else if (state.editing === 'arrangement') {
      const a = state.library.arrangements.find((x) => x.id === state.currentArrangementId);
      if (a) doc = { kind: 'arrangement', value: a };
    } else {
      const song = state.library.songs.find((x) => x.id === state.currentSongId);
      if (song) doc = { kind: 'song', value: song };
    }
    if (!doc) return;
    const id = doc.value.id;
    const suggested = state.fileNames[id] ?? fileNameFor(doc);
    let handle: FileSystemFileHandle | null = state.fileHandles[id] ?? null;
    if (!handle && !options.saveAs) {
      handle = await recallHandle(id);
      if (handle && !(await ensureWritable(handle))) handle = null;
    }
    const result = await saveFile(jsonBlob(doc.value), suggested, {
      handle,
      forceAsk: options.saveAs,
    });
    if (!result) return;
    if (result.handle) {
      set((st) => ({ fileHandles: { ...st.fileHandles, [id]: result.handle! } }));
      void rememberHandle(id, result.handle);
    }
    set((st) => ({
      fileNames: { ...st.fileNames, [id]: result.name },
      recent: pushRecent({ name: result.name, kind: doc!.kind, id }),
    }));
    if (doc.kind === 'riff') get().markRiffClean(id);
    get().toast(`saved ${result.name}`);
  },

  exportLibrary: async () => {
    get().syncCurrentRiff();
    const bundle = bundleToSave(get());
    const result = await saveFile(jsonBlob(bundle), 'library.riffspaced.json', { forceAsk: true });
    if (result) get().toast(`exported library as ${result.name}`);
  },

  importLibrary: async () => {
    const files = await openFiles({ multiple: false });
    const file = files[0];
    if (!file) return;
    const parsed = parseDocument(file.text);
    if (!parsed.ok) {
      get().openDialog({
        kind: 'info',
        title: `could not import ${file.name}`,
        message: parsed.errors.slice(0, 8).join('\n'),
        confirmLabel: 'close',
      });
      return;
    }
    get().importDocument(parsed.doc, file.name);
  },
});

/**
 * Opening and saving files (SPEC 5.7, P5.T4). Chrome has the File System Access API
 * (`showOpenFilePicker`, `showSaveFilePicker`), which gives real file handles so Save can
 * overwrite without asking again. Everywhere else, open falls back to `<input type=file>`
 * and save to an `<a download>` blob link. Callers never know which path ran.
 */

export type OpenedFile = { name: string; text: string; handle: FileSystemFileHandle | null };

type PickerWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
};

export function hasFileSystemAccess(w: Window = window): boolean {
  const pw = w as PickerWindow;
  return typeof pw.showOpenFilePicker === 'function' && typeof pw.showSaveFilePicker === 'function';
}

export const JSON_TYPES = [
  {
    description: 'RIFF-SPACED JSON',
    accept: {
      'application/json': ['.json', '.riff.json', '.arr.json', '.song.json', '.riffspaced.json'],
    },
  },
];

/** Open one or more files. Resolves to an empty list when the user cancels. */
export async function openFiles(
  options: { multiple?: boolean; accept?: string } = {},
): Promise<OpenedFile[]> {
  const pw = window as PickerWindow;
  if (pw.showOpenFilePicker) {
    try {
      const handles = await pw.showOpenFilePicker({
        multiple: options.multiple ?? false,
        types: JSON_TYPES,
      });
      return Promise.all(
        handles.map(async (handle) => {
          const file = await handle.getFile();
          return { name: file.name, text: await file.text(), handle };
        }),
      );
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return [];
      throw error;
    }
  }
  return openFilesFallback(options);
}

function openFilesFallback(options: {
  multiple?: boolean;
  accept?: string;
}): Promise<OpenedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept ?? '.json,application/json';
    input.multiple = options.multiple ?? false;
    input.style.display = 'none';
    input.setAttribute('data-testid', 'file-input');
    input.addEventListener('change', async () => {
      const files = [...(input.files ?? [])];
      const opened = await Promise.all(
        files.map(async (f) => ({ name: f.name, text: await f.text(), handle: null })),
      );
      input.remove();
      resolve(opened);
    });
    // Cancel never fires reliably; leave the element until the next open replaces it.
    document.body.append(input);
    input.click();
  });
}

export type SaveResult = { name: string; handle: FileSystemFileHandle | null } | null;

/**
 * Save a blob. With a handle (a previously opened or saved file) the write goes straight
 * there, which is what makes plain "Save" work. Otherwise ask, or download.
 */
export async function saveFile(
  blob: Blob,
  suggestedName: string,
  options: { handle?: FileSystemFileHandle | null; forceAsk?: boolean } = {},
): Promise<SaveResult> {
  const pw = window as PickerWindow;
  if (pw.showSaveFilePicker) {
    try {
      let handle = options.forceAsk ? null : (options.handle ?? null);
      if (!handle)
        handle = await pw.showSaveFilePicker({
          suggestedName,
          types: suggestedName.endsWith('.json') ? JSON_TYPES : undefined,
        });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { name: handle.name, handle };
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return null;
      throw error;
    }
  }
  downloadBlob(blob, suggestedName);
  return { name: suggestedName, handle: null };
}

/** The classic download trick: an object URL on an anchor with the download attribute. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  // Revoke after the click has been dispatched; some browsers read the URL asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function jsonBlob(value: unknown): Blob {
  return new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
}

/** A file-safe name: letters, digits, dash, underscore; spaces to dashes. */
export function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/-+/g, '-');
  return cleaned || 'untitled';
}

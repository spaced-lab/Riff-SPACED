/**
 * Remember file handles between sessions (P5.T4). File System Access handles can be stored
 * in IndexedDB (not localStorage: they are not serializable). On reload, a handle may need
 * permission again; `queryPermission` / `requestPermission` handle that. Everything here is
 * best effort: without IndexedDB or handles, Save simply asks where to save.
 */

const DB_NAME = 'riffspaced';
const STORE = 'handles';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function rememberHandle(key: string, handle: FileSystemFileHandle): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(handle, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function recallHandle(key: string): Promise<FileSystemFileHandle | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as FileSystemFileHandle | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
}

type PermissionHandle = FileSystemFileHandle & {
  queryPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
};

/** True when we may write to the handle, asking the browser if needed. */
export async function ensureWritable(handle: FileSystemFileHandle): Promise<boolean> {
  const h = handle as PermissionHandle;
  if (!h.queryPermission || !h.requestPermission) return true;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}

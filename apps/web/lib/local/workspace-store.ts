export interface StoredLocalFile {
  name: string;
  type: string;
  bytes: ArrayBuffer;
}

export interface StoredWorkspace {
  id: string;
  title: string;
  query: string;
  draft: unknown;
  files: StoredLocalFile[];
  savedAt: string;
}

const DB_NAME = "chartize";
const STORE = "workspaces";

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local workspace storage."));
  });
}

export async function saveWorkspace(workspace: StoredWorkspace) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(workspace);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save workspace."));
  });
  db.close();
}

export async function loadWorkspace(id = "current") {
  const db = await database();
  const value = await new Promise<StoredWorkspace | undefined>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as StoredWorkspace | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not load workspace."));
  });
  db.close();
  return value;
}

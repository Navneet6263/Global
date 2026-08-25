import type { FieldDraft } from "./types";

const databaseName = "sapling-global-field-v1";
const storeName = "visit-drafts";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "visitId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage unavailable"));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const request = action(database.transaction(storeName, mode).objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage operation failed"));
  }).finally(() => database.close());
}

export async function loadFieldDrafts(): Promise<Record<string, FieldDraft>> {
  const drafts = await transaction<FieldDraft[]>("readonly", (store) => store.getAll());
  return Object.fromEntries(drafts.map((draft) => [draft.visitId, draft]));
}

export function saveFieldDraft(draft: FieldDraft): Promise<IDBValidKey> {
  return transaction("readwrite", (store) => store.put(draft));
}

export function removeFieldDraft(visitId: string): Promise<undefined> {
  return transaction("readwrite", (store) => store.delete(visitId));
}

export function clearFieldDrafts(): Promise<undefined> {
  return transaction("readwrite", (store) => store.clear());
}

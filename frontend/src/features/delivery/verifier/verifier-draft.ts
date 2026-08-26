import type { FindingInput } from "@/lib/api/tasks";

export type VerifierResult = "CLEAR" | "DISCREPANCY" | "UNABLE_TO_VERIFY";

export interface VerifierDraft {
  key: string;
  result: VerifierResult;
  sourceSummary: string;
  findings: FindingInput[];
  savedAt: string;
}

const databaseName = "sapling-global-verifier-v1";
const storeName = "task-drafts";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Draft storage unavailable"));
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const request = action(database.transaction(storeName, mode).objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Draft storage operation failed"));
  }).finally(() => database.close());
}

export function loadVerifierDraft(key: string) {
  return transact<VerifierDraft | undefined>("readonly", (store) => store.get(key));
}

export function saveVerifierDraft(draft: VerifierDraft) {
  return transact<IDBValidKey>("readwrite", (store) => store.put(draft));
}

export function removeVerifierDraft(key: string) {
  return transact<undefined>("readwrite", (store) => store.delete(key));
}

export function clearVerifierDrafts() {
  return transact<undefined>("readwrite", (store) => store.clear());
}

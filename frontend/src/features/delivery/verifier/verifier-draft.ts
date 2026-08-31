import type { FindingInput } from "@/lib/api/tasks";
import {
  assertActiveDeviceDataScope,
  scopedDeviceRecordKey,
  type DeviceDataScope,
} from "@/lib/auth/device-data-scope";
import {
  decryptDevicePayload,
  encryptedRecordExpired,
  encryptDevicePayload,
  isEncryptedDeviceRecord,
  type EncryptedDeviceRecord,
} from "@/lib/offline/encrypted-device-record";

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
const databaseVersion = 2;
const draftTtlMilliseconds = 7 * 24 * 60 * 60 * 1_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const operation = indexedDB.open(databaseName, databaseVersion);
    operation.onupgradeneeded = () => {
      // Purge the legacy v1 store because its findings and source notes were plaintext.
      if (operation.result.objectStoreNames.contains(storeName))
        operation.result.deleteObjectStore(storeName);
      operation.result.createObjectStore(storeName, { keyPath: "recordKey" });
    };
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error ?? new Error("Draft storage unavailable"));
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
  beforeTransaction?: () => void,
) {
  const database = await openDatabase();
  try {
    beforeTransaction?.();
  } catch (error) {
    database.close();
    throw error;
  }
  return new Promise<T>((resolve, reject) => {
    const operation = action(database.transaction(storeName, mode).objectStore(storeName));
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () =>
      reject(operation.error ?? new Error("Draft storage operation failed"));
  }).finally(() => database.close());
}

function belongsToScope(record: EncryptedDeviceRecord, scope: DeviceDataScope): boolean {
  return record.ownerScope === scope && record.recordKey.startsWith(`v2:${scope.length}:${scope}:`);
}

async function removeRecord(recordKey: string): Promise<void> {
  await transact<undefined>("readwrite", (store) => store.delete(recordKey));
}

function validDraft(value: unknown): value is VerifierDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<VerifierDraft>;
  return (
    typeof draft.key === "string" &&
    typeof draft.sourceSummary === "string" &&
    typeof draft.savedAt === "string" &&
    Array.isArray(draft.findings) &&
    ["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"].includes(draft.result ?? "")
  );
}

export async function loadVerifierDraft(
  scope: DeviceDataScope,
  key: string,
): Promise<VerifierDraft | undefined> {
  assertActiveDeviceDataScope(scope);
  const recordKey = scopedDeviceRecordKey(scope, key);
  const value = await transact<unknown>("readonly", (store) => store.get(recordKey));
  if (!isEncryptedDeviceRecord(value) || !belongsToScope(value, scope)) return undefined;
  if (encryptedRecordExpired(value)) {
    await removeRecord(recordKey);
    return undefined;
  }
  try {
    const draft = JSON.parse(decoder.decode(await decryptDevicePayload(value))) as unknown;
    if (!validDraft(draft) || draft.key !== key) throw new Error("Draft identity mismatch");
    assertActiveDeviceDataScope(scope);
    return draft;
  } catch {
    await removeRecord(recordKey);
    return undefined;
  }
}

export async function saveVerifierDraft(
  scope: DeviceDataScope,
  draft: VerifierDraft,
): Promise<IDBValidKey> {
  assertActiveDeviceDataScope(scope);
  const recordKey = scopedDeviceRecordKey(scope, draft.key);
  const record = await encryptDevicePayload(
    recordKey,
    scope,
    encoder.encode(JSON.stringify(draft)),
    draftTtlMilliseconds,
  );
  return transact<IDBValidKey>(
    "readwrite",
    (store) => store.put(record),
    () => assertActiveDeviceDataScope(scope),
  );
}

export function removeVerifierDraft(scope: DeviceDataScope, key: string): Promise<undefined> {
  assertActiveDeviceDataScope(scope);
  return transact<undefined>("readwrite", (store) =>
    store.delete(scopedDeviceRecordKey(scope, key)),
  );
}

export async function retainOnlyVerifierDraftScope(scope: DeviceDataScope): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const cursor = transaction.objectStore(storeName).openCursor();
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (!current) return;
      if (
        !isEncryptedDeviceRecord(current.value) ||
        encryptedRecordExpired(current.value) ||
        !belongsToScope(current.value, scope)
      )
        current.delete();
      current.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Draft storage cleanup failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Draft cleanup aborted"));
  }).finally(() => database.close());
}

export function clearVerifierDrafts(): Promise<undefined> {
  return transact<undefined>("readwrite", (store) => store.clear());
}

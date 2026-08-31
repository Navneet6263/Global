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
import { decodeFieldDraft, encodeFieldDraft } from "./field-draft-codec";
import type { FieldDraft } from "./types";

const databaseName = "sapling-global-field-v1";
const storeName = "visit-drafts";
const databaseVersion = 2;
const draftTtlMilliseconds = 7 * 24 * 60 * 60 * 1_000;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const operation = indexedDB.open(databaseName, databaseVersion);
    operation.onupgradeneeded = () => {
      // Version 1 stored full drafts and evidence Blobs in plaintext. Recreate the
      // store so an update cannot leave legacy private data behind.
      if (operation.result.objectStoreNames.contains(storeName)) {
        operation.result.deleteObjectStore(storeName);
      }
      operation.result.createObjectStore(storeName, { keyPath: "recordKey" });
    };
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error ?? new Error("Offline storage unavailable"));
  });
}

async function request<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
  beforeTransaction?: () => void,
): Promise<T> {
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
      reject(operation.error ?? new Error("Offline storage operation failed"));
  }).finally(() => database.close());
}

async function removeRecords(recordKeys: string[]): Promise<void> {
  if (!recordKeys.length) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    recordKeys.forEach((recordKey) => store.delete(recordKey));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline cleanup failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline cleanup aborted"));
  }).finally(() => database.close());
}

function belongsToScope(record: EncryptedDeviceRecord, scope: DeviceDataScope): boolean {
  return record.ownerScope === scope && record.recordKey.startsWith(`v2:${scope.length}:${scope}:`);
}

export async function loadFieldDrafts(scope: DeviceDataScope): Promise<Record<string, FieldDraft>> {
  assertActiveDeviceDataScope(scope);
  const values = await request<unknown[]>("readonly", (store) => store.getAll());
  const removable: string[] = [];
  const records = values.filter((value): value is EncryptedDeviceRecord => {
    if (!isEncryptedDeviceRecord(value)) return false;
    if (encryptedRecordExpired(value)) {
      removable.push(value.recordKey);
      return false;
    }
    return belongsToScope(value, scope);
  });

  const drafts: FieldDraft[] = [];
  for (const record of records) {
    try {
      const draft = decodeFieldDraft(await decryptDevicePayload(record));
      if (record.recordKey !== scopedDeviceRecordKey(scope, draft.visitId))
        throw new Error("Draft identity mismatch");
      drafts.push(draft);
    } catch {
      removable.push(record.recordKey);
    }
  }
  await removeRecords(removable);
  assertActiveDeviceDataScope(scope);
  return Object.fromEntries(drafts.map((draft) => [draft.visitId, draft]));
}

export async function saveFieldDraft(
  scope: DeviceDataScope,
  draft: FieldDraft,
): Promise<IDBValidKey> {
  assertActiveDeviceDataScope(scope);
  const recordKey = scopedDeviceRecordKey(scope, draft.visitId);
  const record = await encryptDevicePayload(
    recordKey,
    scope,
    await encodeFieldDraft(draft),
    draftTtlMilliseconds,
  );
  return request(
    "readwrite",
    (store) => store.put(record),
    () => assertActiveDeviceDataScope(scope),
  );
}

export function removeFieldDraft(scope: DeviceDataScope, visitId: string): Promise<undefined> {
  assertActiveDeviceDataScope(scope);
  return request("readwrite", (store) => store.delete(scopedDeviceRecordKey(scope, visitId)));
}

export async function retainOnlyFieldDraftScope(scope: DeviceDataScope): Promise<void> {
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
      reject(transaction.error ?? new Error("Offline storage cleanup failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline cleanup aborted"));
  }).finally(() => database.close());
}

export function clearFieldDrafts(): Promise<undefined> {
  return request("readwrite", (store) => store.clear());
}

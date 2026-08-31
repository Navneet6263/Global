import type { DeviceDataScope } from "@/lib/auth/device-data-scope";

const keyDatabaseName = "sapling-global-device-crypto-v1";
const keyStoreName = "keys";
const draftKeyId = "offline-drafts-aes-gcm-v1";
const recordVersion = 1;
const encoder = new TextEncoder();

type StoredKey = { id: string; key: CryptoKey };

export type EncryptedDeviceRecord = {
  recordKey: string;
  ownerScope: DeviceDataScope;
  expiresAt: number;
  version: number;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
};

function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const operation = indexedDB.open(keyDatabaseName, 1);
    operation.onupgradeneeded = () => {
      if (!operation.result.objectStoreNames.contains(keyStoreName)) {
        operation.result.createObjectStore(keyStoreName, { keyPath: "id" });
      }
    };
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () =>
      reject(operation.error ?? new Error("Device key storage unavailable"));
  });
}

async function readKey(): Promise<CryptoKey | undefined> {
  const database = await openKeyDatabase();
  return new Promise<CryptoKey | undefined>((resolve, reject) => {
    const operation = database.transaction(keyStoreName).objectStore(keyStoreName).get(draftKeyId);
    operation.onsuccess = () => resolve((operation.result as StoredKey | undefined)?.key);
    operation.onerror = () => reject(operation.error ?? new Error("Device key could not be read"));
  }).finally(() => database.close());
}

async function addKey(key: CryptoKey): Promise<boolean> {
  const database = await openKeyDatabase();
  return new Promise<boolean>((resolve, reject) => {
    const transaction = database.transaction(keyStoreName, "readwrite");
    const operation = transaction.objectStore(keyStoreName).add({ id: draftKeyId, key });
    let added = false;
    let conflicted = false;
    operation.onsuccess = () => {
      added = true;
    };
    operation.onerror = (event) => {
      if (operation.error?.name === "ConstraintError") {
        event.preventDefault();
        event.stopPropagation();
        conflicted = true;
        return;
      }
    };
    transaction.oncomplete = () => resolve(added && !conflicted);
    transaction.onerror = () =>
      reject(transaction.error ?? operation.error ?? new Error("Device key could not be stored"));
    transaction.onabort = () =>
      reject(transaction.error ?? operation.error ?? new Error("Device key storage aborted"));
  }).finally(() => database.close());
}

function validKey(key: CryptoKey | undefined): key is CryptoKey {
  return Boolean(
    key &&
    key.type === "secret" &&
    !key.extractable &&
    key.algorithm.name === "AES-GCM" &&
    key.usages.includes("encrypt") &&
    key.usages.includes("decrypt"),
  );
}

async function deviceKey(): Promise<CryptoKey> {
  const existing = await readKey();
  if (validKey(existing)) return existing;
  if (existing) throw new Error("Stored offline encryption key is invalid");

  const generated = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
  if (await addKey(generated)) return generated;
  const winningKey = await readKey();
  if (!validKey(winningKey)) throw new Error("Device encryption key could not be established");
  return winningKey;
}

function authenticatedMetadata(
  record: Pick<EncryptedDeviceRecord, "recordKey" | "ownerScope" | "expiresAt" | "version">,
) {
  return encoder.encode(
    `${record.version}\u0000${record.recordKey}\u0000${record.ownerScope}\u0000${record.expiresAt}`,
  );
}

export function isEncryptedDeviceRecord(value: unknown): value is EncryptedDeviceRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EncryptedDeviceRecord>;
  return (
    typeof record.recordKey === "string" &&
    typeof record.ownerScope === "string" &&
    typeof record.expiresAt === "number" &&
    record.version === recordVersion &&
    record.iv instanceof Uint8Array &&
    record.iv.byteLength === 12 &&
    record.ciphertext instanceof ArrayBuffer
  );
}

export function encryptedRecordExpired(record: EncryptedDeviceRecord): boolean {
  return !Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now();
}

export async function encryptDevicePayload(
  recordKey: string,
  ownerScope: DeviceDataScope,
  plaintext: Uint8Array<ArrayBuffer>,
  ttlMilliseconds: number,
): Promise<EncryptedDeviceRecord> {
  if (!Number.isSafeInteger(ttlMilliseconds) || ttlMilliseconds <= 0) {
    throw new Error("Offline draft expiry is invalid");
  }
  const record = {
    recordKey,
    ownerScope,
    expiresAt: Date.now() + ttlMilliseconds,
    version: recordVersion,
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: authenticatedMetadata(record) },
    await deviceKey(),
    plaintext,
  );
  return { ...record, iv, ciphertext };
}

export async function decryptDevicePayload(
  record: EncryptedDeviceRecord,
): Promise<Uint8Array<ArrayBuffer>> {
  if (encryptedRecordExpired(record)) throw new Error("Offline draft expired");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: record.iv, additionalData: authenticatedMetadata(record) },
    await deviceKey(),
    record.ciphertext,
  );
  return new Uint8Array(plaintext);
}

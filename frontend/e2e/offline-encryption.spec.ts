import { expect, test } from "@playwright/test";

test.describe("private offline draft storage", () => {
  test("encrypts field evidence and verifier findings, then purges them on logout", async ({
    page,
  }) => {
    await page.goto("/auth");
    const result = await page.evaluate(async () => {
      const dynamicImport = (path: string) => import(/* @vite-ignore */ path);
      const scopeApi = await dynamicImport("/src/lib/auth/device-data-scope.ts");
      const fieldApi = await dynamicImport("/src/features/field/offline-store.ts");
      const verifierApi = await dynamicImport("/src/features/delivery/verifier/verifier-draft.ts");
      const offlineApi = await dynamicImport("/src/lib/auth/device-offline-data.ts");

      const readAll = (databaseName: string, storeName: string) =>
        new Promise<unknown[]>((resolve, reject) => {
          const opening = indexedDB.open(databaseName);
          opening.onerror = () => reject(opening.error);
          opening.onsuccess = () => {
            const database = opening.result;
            const operation = database.transaction(storeName).objectStore(storeName).getAll();
            operation.onsuccess = () => {
              resolve(operation.result);
              database.close();
            };
            operation.onerror = () => reject(operation.error);
          };
        });
      const collectRawText = async (value: unknown): Promise<string> => {
        if (typeof value === "string") return value;
        if (value instanceof Blob) return value.text();
        if (value instanceof ArrayBuffer) return new TextDecoder().decode(value);
        if (ArrayBuffer.isView(value)) {
          return new TextDecoder().decode(
            new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
          );
        }
        if (!value || typeof value !== "object") return "";
        return (
          await Promise.all(Object.values(value as Record<string, unknown>).map(collectRawText))
        ).join("|");
      };

      const scope = scopeApi.createDeviceDataScope(
        "tenant-encryption-test",
        "user-encryption-test",
      );
      scopeApi.activateDeviceDataScope(scope);
      const fieldSecret = "private GPS remark 19.0760,72.8777";
      const photoSecret = "private evidence bytes 849202";
      const sourceSecret = "confidential university source 9173";
      const findingSecret = "sensitive mismatch detail 7319";

      await Promise.all([
        fieldApi.saveFieldDraft(scope, {
          visitId: "visit-private-1",
          checkIn: {
            lat: 19.076,
            lng: 72.8777,
            accuracy: 8,
            time: "10:12",
            capturedAt: "2026-08-27T10:12:00.000Z",
          },
          photos: [
            {
              id: "photo-private-1",
              blob: new Blob([photoSecret], { type: "image/jpeg" }),
              name: "candidate-door-private.jpg",
              type: "image/jpeg",
              capturedAt: "2026-08-27T10:13:00.000Z",
            },
          ],
          checklist: ["Identity privately confirmed"],
          remarks: fieldSecret,
          synced: false,
        }),
        verifierApi.saveVerifierDraft(scope, {
          key: "task-private-1:check-private-1",
          result: "DISCREPANCY",
          sourceSummary: sourceSecret,
          findings: [
            {
              kind: "OTHER",
              severity: "HIGH",
              title: "Private discrepancy",
              description: findingSecret,
            },
          ],
          savedAt: "2026-08-27T10:14:00.000Z",
        }),
      ]);

      const fieldRecords = await readAll("sapling-global-field-v1", "visit-drafts");
      const verifierRecords = await readAll("sapling-global-verifier-v1", "task-drafts");
      const allRecordText = await collectRawText([...fieldRecords, ...verifierRecords]);
      const plaintextAbsent = [fieldSecret, photoSecret, sourceSecret, findingSecret].every(
        (secret) => !allRecordText.includes(secret),
      );
      const envelopesOnly = [...fieldRecords, ...verifierRecords].every((record) => {
        if (!record || typeof record !== "object") return false;
        const envelope = record as Record<string, unknown>;
        return (
          !("draft" in envelope) &&
          envelope.ciphertext instanceof ArrayBuffer &&
          envelope.iv instanceof Uint8Array
        );
      });

      const keyRecords = await readAll("sapling-global-device-crypto-v1", "keys");
      const storedKey = (keyRecords[0] as { key?: CryptoKey } | undefined)?.key;
      let exportBlocked = false;
      if (storedKey) {
        try {
          await crypto.subtle.exportKey("raw", storedKey);
        } catch {
          exportBlocked = true;
        }
      }

      const loadedField = (await fieldApi.loadFieldDrafts(scope))["visit-private-1"];
      const loadedVerifier = await verifierApi.loadVerifierDraft(
        scope,
        "task-private-1:check-private-1",
      );
      const restoredPhotoText = await loadedField.photos[0].blob.text();

      await offlineApi.clearDeviceOfflineData();
      const remainingField = await readAll("sapling-global-field-v1", "visit-drafts");
      const remainingVerifier = await readAll("sapling-global-verifier-v1", "task-drafts");

      return {
        plaintextAbsent,
        envelopesOnly,
        nonExtractableKey: Boolean(storedKey && !storedKey.extractable && exportBlocked),
        fieldRoundTrip: loadedField.remarks === fieldSecret && restoredPhotoText === photoSecret,
        verifierRoundTrip:
          loadedVerifier?.sourceSummary === sourceSecret &&
          loadedVerifier.findings[0]?.description === findingSecret,
        logoutPurged: remainingField.length === 0 && remainingVerifier.length === 0,
        scopeDeactivated: localStorage.getItem(scopeApi.deviceDataScopeStorageKey) === null,
      };
    });

    expect(result).toEqual({
      plaintextAbsent: true,
      envelopesOnly: true,
      nonExtractableKey: true,
      fieldRoundTrip: true,
      verifierRoundTrip: true,
      logoutPurged: true,
      scopeDeactivated: true,
    });
  });

  test("removes another account's drafts and cleans expired records", async ({ page }) => {
    await page.goto("/auth");
    const result = await page.evaluate(async () => {
      const dynamicImport = (path: string) => import(/* @vite-ignore */ path);
      const scopeApi = await dynamicImport("/src/lib/auth/device-data-scope.ts");
      const fieldApi = await dynamicImport("/src/features/field/offline-store.ts");
      const verifierApi = await dynamicImport("/src/features/delivery/verifier/verifier-draft.ts");
      const offlineApi = await dynamicImport("/src/lib/auth/device-offline-data.ts");

      const count = (databaseName: string, storeName: string) =>
        new Promise<number>((resolve, reject) => {
          const opening = indexedDB.open(databaseName);
          opening.onerror = () => reject(opening.error);
          opening.onsuccess = () => {
            const database = opening.result;
            const operation = database.transaction(storeName).objectStore(storeName).count();
            operation.onsuccess = () => {
              resolve(operation.result);
              database.close();
            };
            operation.onerror = () => reject(operation.error);
          };
        });
      const createLegacyStore = (
        databaseName: string,
        storeName: string,
        keyPath: string,
        record: object,
      ) =>
        new Promise<void>((resolve, reject) => {
          const opening = indexedDB.open(databaseName, 1);
          opening.onupgradeneeded = () => {
            opening.result.createObjectStore(storeName, { keyPath }).put(record);
          };
          opening.onsuccess = () => {
            opening.result.close();
            resolve();
          };
          opening.onerror = () => reject(opening.error);
        });

      const first = scopeApi.createDeviceDataScope("tenant-a", "user-a");
      const second = scopeApi.createDeviceDataScope("tenant-b", "user-b");
      await createLegacyStore("sapling-global-field-v1", "visit-drafts", "visitId", {
        visitId: "legacy-plaintext",
        remarks: "legacy plaintext field evidence",
      });
      await createLegacyStore("sapling-global-verifier-v1", "task-drafts", "key", {
        key: "legacy-plaintext",
        sourceSummary: "legacy plaintext verifier source",
      });
      scopeApi.activateDeviceDataScope(first);
      await fieldApi.loadFieldDrafts(first);
      await verifierApi.loadVerifierDraft(first, "legacy-plaintext");
      const legacyPurged =
        (await count("sapling-global-field-v1", "visit-drafts")) === 0 &&
        (await count("sapling-global-verifier-v1", "task-drafts")) === 0;
      await fieldApi.saveFieldDraft(first, {
        visitId: "visit-a",
        photos: [],
        checklist: [],
        remarks: "account A private note",
        synced: false,
      });
      await verifierApi.saveVerifierDraft(first, {
        key: "task-a:check-a",
        result: "CLEAR",
        sourceSummary: "account A source",
        findings: [],
        savedAt: new Date().toISOString(),
      });

      await offlineApi.prepareDeviceOfflineData(second);
      const afterAccountSwitch =
        (await count("sapling-global-field-v1", "visit-drafts")) === 0 &&
        (await count("sapling-global-verifier-v1", "task-drafts")) === 0;

      await fieldApi.saveFieldDraft(second, {
        visitId: "visit-expired",
        photos: [],
        checklist: [],
        remarks: "expired private note",
        synced: false,
      });
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const opening = indexedDB.open("sapling-global-field-v1");
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("visit-drafts", "readwrite");
        const store = transaction.objectStore("visit-drafts");
        const read = store.getAll();
        read.onsuccess = () => {
          const record = read.result[0] as { expiresAt: number };
          record.expiresAt = Date.now() - 1;
          store.put(record);
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();

      const expiredLoad = await fieldApi.loadFieldDrafts(second);
      return {
        legacyPurged,
        afterAccountSwitch,
        expiredUnavailable: Object.keys(expiredLoad).length === 0,
        expiredDeleted: (await count("sapling-global-field-v1", "visit-drafts")) === 0,
      };
    });

    expect(result).toEqual({
      legacyPurged: true,
      afterAccountSwitch: true,
      expiredUnavailable: true,
      expiredDeleted: true,
    });
  });
});

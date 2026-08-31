import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import {
  migrateSubjectPii,
  type SubjectCipherSnapshot,
  type SubjectPiiRotationRepository,
  type SubjectPiiSnapshot,
} from "../prisma/subject-pii-rotation";
import { SecretBoxService } from "../src/common/security/secret-box.service";

type MemorySubject = SubjectPiiSnapshot & { fullName: string };

class MemorySubjects implements SubjectPiiRotationRepository {
  sealAttempts = 0;
  loseFirstSeal = false;

  constructor(readonly rows: MemorySubject[]) {}

  findPlaintext(afterId: bigint | undefined, limit: number) {
    return Promise.resolve(
      this.rows
        .filter(
          (row) =>
            row.piiCiphertext === null &&
            (row.email !== null || row.phone !== null || row.employeeCode !== null) &&
            (afterId === undefined || row.id > afterId),
        )
        .sort((left, right) => Number(left.id - right.id))
        .slice(0, limit)
        .map((row) => ({ ...row })),
    );
  }

  casSealPlaintext(snapshot: SubjectPiiSnapshot, ciphertext: string, keyVersion: number) {
    this.sealAttempts += 1;
    const row = this.rows.find(({ id }) => id === snapshot.id);
    if (this.loseFirstSeal && this.sealAttempts === 1 && row) {
      row.email = "Concurrent@Example.com";
      return Promise.resolve(false);
    }
    if (!row || !this.matchesPlaintext(row, snapshot)) return Promise.resolve(false);
    row.email = null;
    row.phone = null;
    row.employeeCode = null;
    row.piiCiphertext = ciphertext;
    row.piiKeyVersion = keyVersion;
    return Promise.resolve(true);
  }

  findOutdated(activeVersion: number, afterId: bigint | undefined, limit: number) {
    return Promise.resolve(
      this.rows
        .filter(
          (row) =>
            row.piiCiphertext !== null &&
            row.piiKeyVersion !== activeVersion &&
            (afterId === undefined || row.id > afterId),
        )
        .sort((left, right) => Number(left.id - right.id))
        .slice(0, limit)
        .map(({ id, piiCiphertext, piiKeyVersion }) => ({
          id,
          piiCiphertext,
          piiKeyVersion,
        })),
    );
  }

  casRotateCiphertext(
    snapshot: SubjectCipherSnapshot,
    ciphertext: string,
    keyVersion: number,
  ) {
    const row = this.rows.find(({ id }) => id === snapshot.id);
    if (
      !row ||
      row.piiCiphertext !== snapshot.piiCiphertext ||
      row.piiKeyVersion !== snapshot.piiKeyVersion
    ) {
      return Promise.resolve(false);
    }
    row.piiCiphertext = ciphertext;
    row.piiKeyVersion = keyVersion;
    return Promise.resolve(true);
  }

  countPlaintext() {
    return Promise.resolve(
      this.rows.filter(
        (row) => row.email !== null || row.phone !== null || row.employeeCode !== null,
      ).length,
    );
  }

  countOutdated(activeVersion: number) {
    return Promise.resolve(
      this.rows.filter(
        (row) => row.piiCiphertext !== null && row.piiKeyVersion !== activeVersion,
      ).length,
    );
  }

  private matchesPlaintext(row: MemorySubject, snapshot: SubjectPiiSnapshot) {
    return (
      row.piiCiphertext === null &&
      row.piiKeyVersion === snapshot.piiKeyVersion &&
      row.email === snapshot.email &&
      row.phone === snapshot.phone &&
      row.employeeCode === snapshot.employeeCode
    );
  }
}

function secretBox(version: number, activeKey: string, previous?: Record<string, string>) {
  return new SecretBoxService(
    new ConfigService({
      DATA_ENCRYPTION_KEY_VERSION: version,
      DATA_ENCRYPTION_KEY: activeKey,
      DATA_ENCRYPTION_PREVIOUS_KEYS: previous ? JSON.stringify(previous) : undefined,
      JWT_REFRESH_SECRET: "refresh-secret-0123456789abcdef0123456789",
    }),
  );
}

function rotationCipher(box: SecretBoxService) {
  return {
    activeVersion: box.activeVersion,
    seal: (value: Record<string, string>) => box.seal(value),
    open: (ciphertext: string, version: number) =>
      box.open<Record<string, unknown>>(ciphertext, version),
  };
}

void test("legacy Subject PII sealing resumes after a lost CAS and preserves fullName", async () => {
  const row: MemorySubject = {
    id: 1n,
    fullName: "Operational Candidate Name",
    email: "Legacy@Example.com",
    phone: "+919876543210",
    employeeCode: " EMP-7 ",
    piiCiphertext: null,
    piiKeyVersion: 1,
  };
  const repository = new MemorySubjects([row]);
  repository.loseFirstSeal = true;
  const box = secretBox(2, "new-data-key", { "1": "old-data-key" });

  const result = await migrateSubjectPii(repository, rotationCipher(box));

  assert.deepEqual(result, { sealedLegacy: 1, rotatedCiphertext: 0 });
  assert.equal(repository.sealAttempts, 2);
  assert.equal(row.fullName, "Operational Candidate Name");
  assert.equal(row.email, null);
  assert.equal(row.phone, null);
  assert.equal(row.employeeCode, null);
  assert.deepEqual(box.open(row.piiCiphertext!, row.piiKeyVersion), {
    email: "concurrent@example.com",
    phone: "+919876543210",
    employeeCode: "EMP-7",
  });
});

void test("plaintext columns are not cleared when encryption fails", async () => {
  const row: MemorySubject = {
    id: 2n,
    fullName: "Candidate",
    email: "legacy@example.com",
    phone: null,
    employeeCode: null,
    piiCiphertext: null,
    piiKeyVersion: 1,
  };
  const repository = new MemorySubjects([row]);

  await assert.rejects(
    migrateSubjectPii(repository, {
      activeVersion: 2,
      seal: () => {
        throw new Error("encryption unavailable");
      },
      open: () => ({}),
    }),
    /encryption unavailable/,
  );
  assert.equal(repository.sealAttempts, 0);
  assert.equal(row.email, "legacy@example.com");
  assert.equal(row.piiCiphertext, null);
});

void test("old Subject ciphertext rotates to the active version", async () => {
  const oldKey = "old-data-key";
  const oldBox = secretBox(1, oldKey);
  const row: MemorySubject = {
    id: 3n,
    fullName: "Candidate",
    email: null,
    phone: null,
    employeeCode: null,
    piiCiphertext: oldBox.seal({ email: "encrypted@example.com" }),
    piiKeyVersion: 1,
  };
  const repository = new MemorySubjects([row]);
  const activeBox = secretBox(2, "new-data-key", { "1": oldKey });

  const result = await migrateSubjectPii(repository, rotationCipher(activeBox));

  assert.deepEqual(result, { sealedLegacy: 0, rotatedCiphertext: 1 });
  assert.equal(row.piiKeyVersion, 2);
  assert.deepEqual(activeBox.open(row.piiCiphertext!, 2), {
    email: "encrypted@example.com",
  });
});

void test("migration refuses success while any hybrid plaintext remains", async () => {
  const box = secretBox(2, "new-data-key");
  const repository = new MemorySubjects([
    {
      id: 4n,
      fullName: "Candidate",
      email: "unexpected@example.com",
      phone: null,
      employeeCode: null,
      piiCiphertext: box.seal({ email: "encrypted@example.com" }),
      piiKeyVersion: 2,
    },
  ]);

  await assert.rejects(
    migrateSubjectPii(repository, rotationCipher(box)),
    /made no CAS progress; 1 plaintext Subject PII row/,
  );
});

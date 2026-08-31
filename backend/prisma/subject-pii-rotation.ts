export type SubjectPiiSnapshot = {
  id: bigint;
  email: string | null;
  phone: string | null;
  employeeCode: string | null;
  piiCiphertext: string | null;
  piiKeyVersion: number;
};

export type SubjectCipherSnapshot = Pick<
  SubjectPiiSnapshot,
  "id" | "piiCiphertext" | "piiKeyVersion"
>;

export interface SubjectPiiRotationRepository {
  findPlaintext(afterId: bigint | undefined, limit: number): Promise<SubjectPiiSnapshot[]>;
  casSealPlaintext(
    snapshot: SubjectPiiSnapshot,
    ciphertext: string,
    keyVersion: number,
  ): Promise<boolean>;
  findOutdated(
    activeVersion: number,
    afterId: bigint | undefined,
    limit: number,
  ): Promise<SubjectCipherSnapshot[]>;
  casRotateCiphertext(
    snapshot: SubjectCipherSnapshot,
    ciphertext: string,
    keyVersion: number,
  ): Promise<boolean>;
  countPlaintext(): Promise<number>;
  countOutdated(activeVersion: number): Promise<number>;
}

export interface SubjectPiiRotationCipher {
  activeVersion: number;
  seal(value: Record<string, string>): string;
  open(ciphertext: string, keyVersion: number): Record<string, unknown>;
}

export type SubjectPiiRotationResult = {
  sealedLegacy: number;
  rotatedCiphertext: number;
};

const BATCH_SIZE = 100;
const MAX_STALLED_SWEEPS = 3;

export async function migrateSubjectPii(
  repository: SubjectPiiRotationRepository,
  cipher: SubjectPiiRotationCipher,
): Promise<SubjectPiiRotationResult> {
  const sealedLegacy = await sweepUntilCurrent(
    () => repository.countPlaintext(),
    async () => {
      let changed = 0;
      let cursor: bigint | undefined;
      for (;;) {
        const rows = await repository.findPlaintext(cursor, BATCH_SIZE);
        if (!rows.length) return changed;
        for (const row of rows) {
          // Encryption happens before the CAS update that clears plaintext.
          const ciphertext = cipher.seal(legacyPii(row));
          if (
            await repository.casSealPlaintext(
              row,
              ciphertext,
              cipher.activeVersion,
            )
          ) {
            changed += 1;
          }
        }
        cursor = rows.at(-1)!.id;
      }
    },
    "plaintext Subject PII",
  );

  const rotatedCiphertext = await sweepUntilCurrent(
    () => repository.countOutdated(cipher.activeVersion),
    async () => {
      let changed = 0;
      let cursor: bigint | undefined;
      for (;;) {
        const rows = await repository.findOutdated(
          cipher.activeVersion,
          cursor,
          BATCH_SIZE,
        );
        if (!rows.length) return changed;
        for (const row of rows) {
          if (!row.piiCiphertext) continue;
          const value = cipher.open(row.piiCiphertext, row.piiKeyVersion);
          const ciphertext = cipher.seal(value as Record<string, string>);
          if (
            await repository.casRotateCiphertext(
              row,
              ciphertext,
              cipher.activeVersion,
            )
          ) {
            changed += 1;
          }
        }
        cursor = rows.at(-1)!.id;
      }
    },
    "outdated Subject ciphertext",
  );

  const [plaintextRemaining, outdatedRemaining] = await Promise.all([
    repository.countPlaintext(),
    repository.countOutdated(cipher.activeVersion),
  ]);
  if (plaintextRemaining || outdatedRemaining) {
    throw new Error(
      `Subject PII migration incomplete: ${plaintextRemaining} plaintext, ${outdatedRemaining} outdated ciphertext remain`,
    );
  }
  return { sealedLegacy, rotatedCiphertext };
}

function legacyPii(row: SubjectPiiSnapshot): Record<string, string> {
  return {
    ...(row.email !== null ? { email: row.email.trim().toLowerCase() } : {}),
    ...(row.phone !== null ? { phone: row.phone.trim() } : {}),
    ...(row.employeeCode !== null
      ? { employeeCode: row.employeeCode.trim() }
      : {}),
  };
}

async function sweepUntilCurrent(
  remaining: () => Promise<number>,
  sweep: () => Promise<number>,
  label: string,
) {
  let changed = 0;
  let stalled = 0;
  for (;;) {
    const current = await remaining();
    if (!current) return changed;
    const sweepChanges = await sweep();
    changed += sweepChanges;
    if (sweepChanges) {
      stalled = 0;
      continue;
    }
    stalled += 1;
    if (stalled >= MAX_STALLED_SWEEPS) {
      throw new Error(
        `Subject PII migration made no CAS progress; ${current} ${label} row(s) remain. Rerun after concurrent writers settle.`,
      );
    }
  }
}

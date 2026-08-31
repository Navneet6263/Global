import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  migrateSubjectPii,
  type SubjectPiiRotationRepository,
} from "./subject-pii-rotation";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const adapter = new PrismaMssql({
  server: required("DB_HOST"),
  port: Number(process.env.DB_PORT ?? 1433),
  database: required("DB_NAME"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  options: {
    encrypt: process.env.DB_ENCRYPT !== "false",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
  },
});
const prisma = new PrismaClient({ adapter });
const secrets = new SecretBoxService(new ConfigService(process.env));

async function rotateSubjects() {
  const repository: SubjectPiiRotationRepository = {
    findPlaintext: (afterId, limit) =>
      prisma.subject.findMany({
        where: {
          piiCiphertext: null,
          OR: [
            { email: { not: null } },
            { phone: { not: null } },
            { employeeCode: { not: null } },
          ],
          ...(afterId ? { id: { gt: afterId } } : {}),
        },
        // fullName intentionally remains operational plaintext and is never selected here.
        select: {
          id: true,
          email: true,
          phone: true,
          employeeCode: true,
          piiCiphertext: true,
          piiKeyVersion: true,
        },
        orderBy: { id: "asc" },
        take: limit,
      }),
    casSealPlaintext: async (snapshot, ciphertext, keyVersion) => {
      const result = await prisma.subject.updateMany({
        where: {
          id: snapshot.id,
          email: snapshot.email,
          phone: snapshot.phone,
          employeeCode: snapshot.employeeCode,
          piiCiphertext: null,
          piiKeyVersion: snapshot.piiKeyVersion,
        },
        data: {
          email: null,
          phone: null,
          employeeCode: null,
          piiCiphertext: ciphertext,
          piiKeyVersion: keyVersion,
        },
      });
      return result.count === 1;
    },
    findOutdated: (activeVersion, afterId, limit) =>
      prisma.subject.findMany({
        where: {
          piiCiphertext: { not: null },
          piiKeyVersion: { not: activeVersion },
          ...(afterId ? { id: { gt: afterId } } : {}),
        },
        select: { id: true, piiCiphertext: true, piiKeyVersion: true },
        orderBy: { id: "asc" },
        take: limit,
      }),
    casRotateCiphertext: async (snapshot, ciphertext, keyVersion) => {
      const result = await prisma.subject.updateMany({
        where: {
          id: snapshot.id,
          piiCiphertext: snapshot.piiCiphertext,
          piiKeyVersion: snapshot.piiKeyVersion,
        },
        data: { piiCiphertext: ciphertext, piiKeyVersion: keyVersion },
      });
      return result.count === 1;
    },
    countPlaintext: () =>
      prisma.subject.count({
        where: {
          OR: [
            { email: { not: null } },
            { phone: { not: null } },
            { employeeCode: { not: null } },
          ],
        },
      }),
    countOutdated: (activeVersion) =>
      prisma.subject.count({
        where: {
          piiCiphertext: { not: null },
          piiKeyVersion: { not: activeVersion },
        },
      }),
  };
  return migrateSubjectPii(repository, {
    activeVersion: secrets.activeVersion,
    seal: (value) => secrets.seal(value),
    open: (ciphertext, keyVersion) =>
      secrets.open<Record<string, unknown>>(ciphertext, keyVersion),
  });
}

async function rotateIdempotencyResponses() {
  let rotated = 0;
  for (;;) {
    const rows = await prisma.idempotencyKey.findMany({
      where: {
        responseCiphertext: { not: null },
        responseKeyVersion: { not: secrets.activeVersion },
      },
      select: {
        id: true,
        responseCiphertext: true,
        responseKeyVersion: true,
      },
      orderBy: { id: "asc" },
      take: 100,
    });
    if (!rows.length) return rotated;
    for (const row of rows) {
      const version = row.responseKeyVersion ?? 1;
      const value = secrets.open(row.responseCiphertext!, version);
      const result = await prisma.idempotencyKey.updateMany({
        where: {
          id: row.id,
          responseCiphertext: row.responseCiphertext,
          responseKeyVersion: row.responseKeyVersion,
        },
        data: {
          responseCiphertext: secrets.seal(value),
          responseKeyVersion: secrets.activeVersion,
        },
      });
      rotated += result.count;
    }
  }
}

async function rotatePendingOutboxSecrets() {
  let rotated = 0;
  let cursor: bigint | undefined;
  for (;;) {
    const rows = await prisma.outboxEvent.findMany({
      where: {
        status: { in: ["PENDING", "RETRY"] },
        topic: { in: ["consent.otp.requested", "dashboard.executive.delivery"] },
        NOT: { payloadJson: "{}" },
      },
      select: { id: true, payloadJson: true },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) return rotated;
    const outdated = rows.flatMap((row) => {
      const payload = JSON.parse(row.payloadJson) as { secret?: string };
      if (!payload.secret || payload.secret.startsWith(`v${secrets.activeVersion}.`)) {
        return [];
      }
      const value = secrets.open(payload.secret);
      return [{ ...row, payload: { ...payload, secret: secrets.seal(value) } }];
    });
    for (const row of outdated) {
      const result = await prisma.outboxEvent.updateMany({
        where: { id: row.id, payloadJson: row.payloadJson },
        data: { payloadJson: JSON.stringify(row.payload) },
      });
      rotated += result.count;
    }
    cursor = rows.at(-1)!.id;
  }
}

async function main() {
  const result = {
    activeVersion: secrets.activeVersion,
    subjects: await rotateSubjects(),
    idempotencyResponses: await rotateIdempotencyResponses(),
    pendingOutboxSecrets: await rotatePendingOutboxSecrets(),
  };
  const [plaintextSubjects, oldSubjects, oldResponses] = await Promise.all([
    prisma.subject.count({
      where: {
        OR: [
          { email: { not: null } },
          { phone: { not: null } },
          { employeeCode: { not: null } },
        ],
      },
    }),
    prisma.subject.count({
      where: {
        piiCiphertext: { not: null },
        piiKeyVersion: { not: secrets.activeVersion },
      },
    }),
    prisma.idempotencyKey.count({
      where: {
        responseCiphertext: { not: null },
        responseKeyVersion: { not: secrets.activeVersion },
      },
    }),
  ]);
  if (plaintextSubjects || oldSubjects || oldResponses) {
    throw new Error(
      `Key rotation incomplete: ${plaintextSubjects} plaintext subjects, ${oldSubjects} outdated subjects, ${oldResponses} responses remain`,
    );
  }
  console.log(JSON.stringify(result));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

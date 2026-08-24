import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { ConfigService } from "@nestjs/config";
import { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { PrismaClient } from "../src/generated/prisma/client";

const runId = required("E2E_GOLDEN_RUN_ID").trim().toLowerCase();
if (process.env.NODE_ENV === "production") {
  throw new Error("Golden-flow cleanup is disabled in production");
}
if (!/^[a-z0-9]{6,20}$/.test(runId)) {
  throw new Error(
    "E2E_GOLDEN_RUN_ID must contain 6-20 lowercase letters or digits",
  );
}

const clientCode = `GF${runId.toUpperCase()}`;
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
const storage = new LocalObjectStorageService(
  new ConfigService({
    ...process.env,
    OBJECT_STORAGE_PATH: process.env.OBJECT_STORAGE_PATH ?? ".data/objects",
  }),
);

async function main(): Promise<void> {
  const managedUserEmail = `managed-${runId}@e2e.invalid`;
  const managedUser = await prisma.user.findFirst({
    where: {
      normalizedEmail: managedUserEmail,
      tenant: { code: "SAPLING" },
    },
    select: { id: true, publicId: true },
  });
  const client = await prisma.client.findFirst({
    where: { code: clientCode, tenant: { code: "SAPLING" } },
    select: {
      id: true,
      tenantId: true,
      cases: {
        select: {
          id: true,
          publicId: true,
          subjectId: true,
          checks: { select: { publicId: true } },
          clarifications: { select: { publicId: true } },
          reports: { select: { publicId: true } },
        },
      },
    },
  });
  if (!client) {
    if (managedUser) {
      await prisma.$transaction(async (tx) => {
        await deleteManagedUser(tx, managedUser);
      });
    }
    console.log(
      JSON.stringify({
        action: managedUser ? "deleted-user-only" : "nothing-to-delete",
        clientCode,
      }),
    );
    return;
  }

  const objectRows = await Promise.all([
    prisma.documentVersion.findMany({
      where: { document: { case: { clientId: client.id } } },
      select: { objectKey: true },
    }),
    prisma.reportVersion.findMany({
      where: { report: { case: { clientId: client.id } } },
      select: { objectKey: true },
    }),
  ]);
  for (const { objectKey } of objectRows.flat()) {
    await storage.delete(objectKey);
  }

  const caseIds = client.cases.map((item) => item.id);
  const casePublicIds = client.cases.map((item) => item.publicId);
  const subjectIds = client.cases.map((item) => item.subjectId);
  const aggregateIds = [
    ...casePublicIds,
    ...client.cases.flatMap((item) =>
      item.checks.map((check) => check.publicId),
    ),
    ...client.cases.flatMap((item) =>
      item.clarifications.map((clarification) => clarification.publicId),
    ),
    ...client.cases.flatMap((item) =>
      item.reports.map((report) => report.publicId),
    ),
  ];

  await prisma.$transaction(
    async (tx) => {
      if (casePublicIds.length) {
        await tx.notification.deleteMany({
          where: { href: { in: casePublicIds.map((id) => `/cases/${id}`) } },
        });
      }
      if (aggregateIds.length) {
        await tx.outboxEvent.deleteMany({
          where: {
            tenantId: client.tenantId,
            aggregateId: { in: aggregateIds },
          },
        });
      }
      await tx.idempotencyKey.deleteMany({
        where: {
          tenantId: client.tenantId,
          key: { startsWith: `gf:${runId}:` },
        },
      });
      if (managedUser) await deleteManagedUser(tx, managedUser);
      if (caseIds.length) {
        await tx.verificationCase.deleteMany({
          where: { id: { in: caseIds } },
        });
      }
      if (subjectIds.length) {
        await tx.subject.deleteMany({ where: { id: { in: subjectIds } } });
      }
      await tx.client.delete({ where: { id: client.id } });
    },
    { maxWait: 30_000, timeout: 120_000 },
  );
  console.log(
    JSON.stringify({
      action: "deleted",
      clientCode,
      cases: caseIds.length,
      objects: objectRows.flat().length,
    }),
  );
}

async function deleteManagedUser(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  user: { id: bigint; publicId: string },
): Promise<void> {
  await tx.notification.deleteMany({ where: { userId: user.id } });
  await tx.auditEvent.deleteMany({
    where: {
      OR: [
        { actorUserId: user.id },
        { resourceType: "user", resourcePublicId: user.publicId },
      ],
    },
  });
  await tx.user.delete({ where: { id: user.id } });
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

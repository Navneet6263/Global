import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { ConfigService } from "@nestjs/config";
import { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { PrismaClient } from "../src/generated/prisma/client";

const runId = required("E2E_GOLDEN_RUN_ID").trim().toLowerCase();
if (process.env.NODE_ENV !== "development") {
  throw new Error(
    "Golden-flow cleanup runs only in the isolated development E2E environment",
  );
}
if (process.env.E2E_GOLDEN_ISOLATED !== "true") {
  throw new Error("E2E_GOLDEN_ISOLATED=true is required for golden cleanup");
}
if ((process.env.OBJECT_STORAGE_DRIVER ?? "local") !== "local") {
  throw new Error(
    "Golden cleanup accepts only the disposable local E2E object store",
  );
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
  const [permission] = await prisma.$queryRaw<
    Array<{ databasePrincipal: string; canDeleteAudit: number }>
  >`SELECT CURRENT_USER AS [databasePrincipal], HAS_PERMS_BY_NAME('dbo.AuditEvent', 'OBJECT', 'DELETE') AS [canDeleteAudit]`;
  if (!permission || Number(permission.canDeleteAudit) !== 1) {
    throw new Error(
      "Golden cleanup requires the isolated migration/fixture database identity with AuditEvent DELETE permission; never use the append-only runtime identity",
    );
  }
  const managedUserEmails = [
    `managed-verifier-${runId}@e2e.invalid`,
    `managed-qa-${runId}@e2e.invalid`,
    `managed-${runId}@e2e.invalid`,
  ];
  const tenant = await prisma.tenant.findUnique({
    where: { code: "SAPLING" },
    select: { id: true },
  });
  if (!tenant) throw new Error("SAPLING tenant was not found");
  const managedUsers = await prisma.user.findMany({
    where: {
      normalizedEmail: { in: managedUserEmails },
      tenantId: tenant.id,
    },
    select: { id: true, publicId: true },
  });
  const client = await prisma.client.findFirst({
    where: { code: clientCode, tenantId: tenant.id },
    select: {
      id: true,
      publicId: true,
      tenantId: true,
      cases: {
        select: {
          id: true,
          publicId: true,
          subjectId: true,
          checks: {
            select: {
              publicId: true,
              tasks: { select: { publicId: true } },
            },
          },
          consents: { select: { publicId: true } },
          documents: { select: { publicId: true } },
          clarifications: { select: { publicId: true } },
          reports: { select: { publicId: true } },
        },
      },
    },
  });
  if (!client) {
    await prisma.$transaction(async (tx) => {
      await deleteRunIdempotency(tx, tenant.id);
      for (const user of managedUsers) await deleteManagedUser(tx, user);
    });
    console.log(
      JSON.stringify({
        action: managedUsers.length
          ? "deleted-users-only"
          : "nothing-to-delete",
        clientCode,
        databasePrincipal: permission.databasePrincipal,
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

  const caseIds = client.cases.map((item) => item.id);
  const casePublicIds = client.cases.map((item) => item.publicId);
  const subjectIds = client.cases.map((item) => item.subjectId);
  const aggregateIds = [
    ...casePublicIds,
    ...client.cases.flatMap((item) =>
      item.checks.map((check) => check.publicId),
    ),
    ...client.cases.flatMap((item) =>
      item.consents.map((consent) => consent.publicId),
    ),
    ...client.cases.flatMap((item) =>
      item.clarifications.map((clarification) => clarification.publicId),
    ),
    ...client.cases.flatMap((item) =>
      item.reports.map((report) => report.publicId),
    ),
  ];
  const resourcePublicIds = [
    client.publicId,
    ...aggregateIds,
    ...client.cases.flatMap((item) =>
      item.documents.map((document) => document.publicId),
    ),
    ...client.cases.flatMap((item) =>
      item.checks.flatMap((check) => check.tasks.map((task) => task.publicId)),
    ),
    ...managedUsers.map((user) => user.publicId),
  ];
  const managedUserIds = managedUsers.map((user) => user.id);

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
      await tx.auditEvent.deleteMany({
        where: {
          tenantId: client.tenantId,
          OR: [
            { resourcePublicId: { in: resourcePublicIds } },
            ...(managedUserIds.length
              ? [{ actorUserId: { in: managedUserIds } }]
              : []),
          ],
        },
      });
      await deleteRunIdempotency(tx, client.tenantId);
      if (caseIds.length) {
        await tx.verificationCase.deleteMany({
          where: { id: { in: caseIds } },
        });
      }
      for (const user of managedUsers) await deleteManagedUser(tx, user);
      if (subjectIds.length) {
        await tx.subject.deleteMany({ where: { id: { in: subjectIds } } });
      }
      await tx.client.delete({ where: { id: client.id } });
    },
    { maxWait: 30_000, timeout: 120_000 },
  );
  const failedObjectKeys: string[] = [];
  for (const { objectKey } of objectRows.flat()) {
    try {
      await storage.delete(objectKey);
    } catch {
      failedObjectKeys.push(objectKey);
    }
  }
  if (failedObjectKeys.length) {
    console.error(
      JSON.stringify({
        action: "database-deleted-object-cleanup-incomplete",
        failedObjectKeys,
        retry:
          "Delete these keys from the isolated E2E object store, then rerun cleanup to confirm the database fixture is absent.",
      }),
    );
    throw new Error(
      `Database fixtures were deleted, but ${failedObjectKeys.length} object(s) require manual storage cleanup`,
    );
  }
  console.log(
    JSON.stringify({
      action: "deleted",
      clientCode,
      cases: caseIds.length,
      objects: objectRows.flat().length,
      users: managedUsers.length,
      databasePrincipal: permission.databasePrincipal,
    }),
  );
}

function deleteRunIdempotency(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tenantId: bigint,
) {
  return tx.idempotencyKey.deleteMany({
    where: {
      tenantId,
      OR: [
        { key: { startsWith: `golden:${runId}:` } },
        { key: { startsWith: `gf:${runId}:` } },
      ],
    },
  });
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

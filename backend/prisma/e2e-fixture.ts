import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { hashPassword } from "../src/auth/password";
import {
  isValidUserPassword,
  USER_PASSWORD_REQUIREMENTS,
} from "../src/auth/password-policy";
import { PrismaClient } from "../src/generated/prisma/client";

const action = required("E2E_FIXTURE_ACTION");
const email = required("E2E_ADMIN_EMAIL").trim().toLowerCase();
const mustChangePassword =
  process.env.E2E_ADMIN_MUST_CHANGE_PASSWORD === "true";

if (process.env.NODE_ENV === "production") {
  throw new Error("E2E fixtures are disabled in production");
}
if (!email.endsWith("@e2e.invalid")) {
  throw new Error("E2E_ADMIN_EMAIL must use the reserved @e2e.invalid domain");
}
if (!(["create", "delete"] as const).includes(action as "create" | "delete")) {
  throw new Error("E2E_FIXTURE_ACTION must be create or delete");
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

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { code: "SAPLING" },
    select: { id: true },
  });
  if (!tenant) throw new Error("SAPLING tenant was not found");

  const existing = await prisma.user.findUnique({
    where: {
      tenantId_normalizedEmail: {
        tenantId: tenant.id,
        normalizedEmail: email,
      },
    },
    select: { id: true },
  });

  if (action === "delete") {
    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { userId: existing.id } });
        await tx.auditEvent.deleteMany({ where: { actorUserId: existing.id } });
        await tx.user.delete({ where: { id: existing.id } });
      });
    }
    console.log(JSON.stringify({ action: "deleted", email }));
    return;
  }

  if (existing) throw new Error("The E2E fixture user already exists");
  const password = required("E2E_ADMIN_PASSWORD");
  if (!isValidUserPassword(password)) {
    throw new Error(`E2E_ADMIN_PASSWORD ${USER_PASSWORD_REQUIREMENTS}`);
  }
  const [branch, role] = await Promise.all([
    prisma.branch.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: "HQ" } },
      select: { id: true },
    }),
    prisma.role.findUnique({
      where: {
        tenantId_code: { tenantId: tenant.id, code: "PLATFORM_ADMIN" },
      },
      select: { id: true },
    }),
  ]);
  if (!role) throw new Error("PLATFORM_ADMIN role was not found");

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch?.id,
        email,
        normalizedEmail: email,
        displayName: "Release verification administrator",
        passwordHash: await hashPassword(password),
        mustChangePassword,
      },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
  });
  console.log(JSON.stringify({ action: "created", email }));
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

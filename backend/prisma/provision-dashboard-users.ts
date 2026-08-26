import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { hashPassword } from "../src/auth/password";
import {
  isValidUserPassword,
  USER_PASSWORD_REQUIREMENTS,
} from "../src/auth/password-policy";
import { PrismaClient } from "../src/generated/prisma/client";

const tenantCode = process.env.DASHBOARD_USER_TENANT_CODE?.trim() || "SAPLING";
const emailDomain =
  process.env.DASHBOARD_USER_DOMAIN?.trim().toLowerCase() || "greencall.com";
const password = required("DASHBOARD_USER_PASSWORD");

if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(emailDomain)) {
  throw new Error("DASHBOARD_USER_DOMAIN must be a valid email domain");
}
if (!isValidUserPassword(password)) {
  throw new Error(`DASHBOARD_USER_PASSWORD ${USER_PASSWORD_REQUIREMENTS}`);
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

const accounts = [
  {
    localPart: "admin",
    displayName: "Platform Administrator",
    roleCode: "PLATFORM_ADMIN",
  },
  {
    localPart: "operations",
    displayName: "Operations Manager",
    roleCode: "OPS_MANAGER",
  },
  { localPart: "verifier", displayName: "Verifier", roleCode: "VERIFIER" },
  { localPart: "qa", displayName: "QA Reviewer", roleCode: "QA_REVIEWER" },
  {
    localPart: "client",
    displayName: "Client Administrator",
    roleCode: "CLIENT_ADMIN",
  },
  {
    localPart: "field",
    displayName: "Field Executive",
    roleCode: "FIELD_EXECUTIVE",
  },
  { localPart: "crm", displayName: "Sales Manager", roleCode: "SALES_MANAGER" },
  {
    localPart: "finance",
    displayName: "Finance Manager",
    roleCode: "FINANCE_MANAGER",
  },
] as const;

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { code: tenantCode },
    select: { id: true, code: true },
  });
  if (!tenant) throw new Error(`Tenant ${tenantCode} was not found`);

  const [branch, client, roles] = await Promise.all([
    prisma.branch.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ code: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.client.findFirst({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: { id: true, displayName: true },
    }),
    prisma.role.findMany({
      where: {
        tenantId: tenant.id,
        code: { in: accounts.map(({ roleCode }) => roleCode) },
      },
      select: { id: true, code: true },
    }),
  ]);

  if (!branch) throw new Error("An active operating branch is required");
  if (!client)
    throw new Error(
      "An active client is required for the Client Admin account",
    );
  const rolesByCode = new Map(roles.map((role) => [role.code, role.id]));
  const missingRoles = accounts
    .map(({ roleCode }) => roleCode)
    .filter((roleCode) => !rolesByCode.has(roleCode));
  if (missingRoles.length)
    throw new Error(`Missing roles: ${missingRoles.join(", ")}`);

  const provisioned: Array<{
    email: string;
    role: string;
    action: "created" | "reset";
  }> = [];

  for (const account of accounts) {
    const email = `${account.localPart}@${emailDomain}`;
    const existing = await prisma.user.findUnique({
      where: {
        tenantId_normalizedEmail: {
          tenantId: tenant.id,
          normalizedEmail: email,
        },
      },
      select: { id: true, publicId: true },
    });
    const passwordHash = await hashPassword(password);
    const roleId = rolesByCode.get(account.roleCode)!;
    const branchId = account.roleCode === "CLIENT_ADMIN" ? null : branch.id;
    const clientId = account.roleCode === "CLIENT_ADMIN" ? client.id : null;

    await prisma.$transaction(async (tx) => {
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              displayName: account.displayName,
              email,
              normalizedEmail: email,
              branchId,
              clientId,
              passwordHash,
              mustChangePassword: false,
              status: "ACTIVE",
              failedLoginCount: 0,
              lockedUntil: null,
              passwordChangedAt: new Date(),
              version: { increment: 1 },
            },
            select: { id: true, publicId: true },
          })
        : await tx.user.create({
            data: {
              tenantId: tenant.id,
              branchId,
              clientId,
              email,
              normalizedEmail: email,
              displayName: account.displayName,
              passwordHash,
              mustChangePassword: false,
              status: "ACTIVE",
            },
            select: { id: true, publicId: true },
          });

      await tx.userRole.deleteMany({ where: { userId: user.id } });
      await tx.userRole.create({ data: { userId: user.id, roleId } });
      await tx.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          action: existing ? "dashboard-user.reset" : "dashboard-user.created",
          resourceType: "user",
          resourcePublicId: user.publicId,
          afterJson: JSON.stringify({ email, role: account.roleCode }),
        },
      });
    });

    provisioned.push({
      email,
      role: account.roleCode,
      action: existing ? "reset" : "created",
    });
  }

  console.log(
    JSON.stringify(
      {
        tenant: tenant.code,
        branch: branch.name,
        client: client.displayName,
        passwordChangeRequired: false,
        accounts: provisioned,
      },
      null,
      2,
    ),
  );
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

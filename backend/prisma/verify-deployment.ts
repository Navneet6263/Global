import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../src/generated/prisma/client";

const requiredRoleCodes = [
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "VERIFIER",
  "QA_REVIEWER",
  "CLIENT_ADMIN",
  "FIELD_EXECUTIVE",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
] as const;

function required(name: string): string {
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

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { code: "SAPLING" },
    include: {
      fieldPolicy: true,
      roles: { select: { id: true, code: true, permissionsJson: true } },
      servicePackages: {
        where: { code: "STANDARD_BGV" },
        select: { id: true },
      },
    },
  });
  if (!tenant || tenant.name !== "Sapling Global") {
    throw new Error("SAPLING / Sapling Global tenant was not found");
  }
  if (!tenant.fieldPolicy) throw new Error("Default field policy is missing");
  if (tenant.servicePackages.length !== 1) {
    throw new Error("STANDARD_BGV service package is missing");
  }

  const rolesByCode = new Map(tenant.roles.map((role) => [role.code, role]));
  for (const code of requiredRoleCodes) {
    const role = rolesByCode.get(code);
    if (!role) throw new Error(`Required role ${code} is missing`);
    const permissions = JSON.parse(role.permissionsJson) as unknown;
    if (!Array.isArray(permissions) || permissions.length === 0) {
      throw new Error(`Required role ${code} has no permissions`);
    }
  }

  const platformAdminRole = rolesByCode.get("PLATFORM_ADMIN")!;
  const [userCount, platformAdminCount, persistedTables] = await Promise.all([
    prisma.user.count({ where: { tenantId: tenant.id } }),
    prisma.userRole.count({ where: { roleId: platformAdminRole.id } }),
    Promise.all([
      prisma.salesOpportunity.count({ where: { tenantId: tenant.id } }),
      prisma.invoice.count({ where: { tenantId: tenant.id } }),
      prisma.notification.count({ where: { tenantId: tenant.id } }),
      prisma.candidatePortalAccess.count({ where: { tenantId: tenant.id } }),
    ]),
  ]);
  if (userCount === 0 || platformAdminCount === 0) {
    throw new Error("An assigned platform administrator is required");
  }

  console.log(
    JSON.stringify({
      tenant: tenant.code,
      roles: requiredRoleCodes.length,
      users: userCount,
      platformAdministrators: platformAdminCount,
      persistedTablesAccessible: persistedTables.length,
    }),
  );
  console.log("Deployment data verification passed.");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

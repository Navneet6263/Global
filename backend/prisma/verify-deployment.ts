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

const requiredMigrations = [
  "0001_init",
  "20260820160000_business_modules",
  "20260825130000_delivery_workspaces",
  "20260825143000_field_evidence_read",
  "20260825180000_session_device_name",
  "20260826100000_crm_follow_up",
  "20260826113000_finance_credit_notes",
  "20260827120000_crm_opportunity_details",
  "20260827133000_case_service_package",
  "20260827144500_crm_onboarding_handoff",
  "20260827160000_outbox_claim_lease",
  "20260827170000_idempotency_security",
  "20260827180000_redact_location_audit",
  "20260827190000_invoice_statuses",
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

  const [userCount, platformAdminCount, persistedTables, migrations] = await Promise.all([
    prisma.user.count({ where: { tenantId: tenant.id } }),
    prisma.user.count({
      where: {
        tenantId: tenant.id,
        status: "ACTIVE",
        userRoles: { some: { role: { code: "PLATFORM_ADMIN" } } },
      },
    }),
    Promise.all([
      prisma.salesOpportunity.count({ where: { tenantId: tenant.id } }),
      prisma.invoice.count({ where: { tenantId: tenant.id } }),
      prisma.creditNote.count({ where: { tenantId: tenant.id } }),
      prisma.notification.count({ where: { tenantId: tenant.id } }),
      prisma.candidatePortalAccess.count({ where: { tenantId: tenant.id } }),
      prisma.salesOpportunity.findFirst({
        select: { contactPhone: true, onboardingHandoffAt: true },
      }),
      prisma.verificationCase.findFirst({ select: { servicePackageId: true } }),
      prisma.outboxEvent.findFirst({ select: { claimedAt: true, claimToken: true } }),
      prisma.idempotencyKey.findFirst({
        select: {
          responseCiphertext: true,
          responseKeyVersion: true,
          completedAt: true,
        },
      }),
    ]),
    prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      "SELECT [migration_name] FROM [_prisma_migrations] WHERE [finished_at] IS NOT NULL AND [rolled_back_at] IS NULL",
    ),
  ]);
  if (userCount === 0 || platformAdminCount === 0) {
    throw new Error("An assigned platform administrator is required");
  }
  const appliedMigrations = new Set(migrations.map((row) => row.migration_name));
  const missingMigrations = requiredMigrations.filter(
    (migration) => !appliedMigrations.has(migration),
  );
  if (missingMigrations.length) {
    throw new Error(`Missing database migrations: ${missingMigrations.join(", ")}`);
  }

  console.log(
    JSON.stringify({
      tenant: tenant.code,
      roles: requiredRoleCodes.length,
      users: userCount,
      platformAdministrators: platformAdminCount,
      migrations: requiredMigrations.length,
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

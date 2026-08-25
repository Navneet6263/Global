import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../src/generated/prisma/client";
import { Permission } from "../src/common/auth/permissions";
import { hashPassword } from "../src/auth/password";

const adapter = new PrismaMssql({
  server: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 1433),
  database: process.env.DB_NAME ?? "Sapling Global",
  user: process.env.DB_USER ?? "sapling_global_app",
  password: process.env.DB_PASSWORD ?? "",
  options: {
    encrypt: process.env.DB_ENCRYPT !== "false",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
  },
});
const prisma = new PrismaClient({ adapter });

const rolePermissions: Record<string, string[]> = {
  PLATFORM_ADMIN: ["*"],
  OPS_MANAGER: [
    Permission.DashboardRead,
    Permission.ClientRead,
    Permission.ClientWrite,
    Permission.CaseRead,
    Permission.CaseCreate,
    Permission.CaseTransition,
    Permission.ConsentManage,
    Permission.DocumentRead,
    Permission.DocumentWrite,
    Permission.TaskRead,
    Permission.TaskWrite,
    Permission.ClarificationRead,
    Permission.ClarificationWrite,
    Permission.ReportRead,
    Permission.FieldVisitRead,
    Permission.FieldVisitWrite,
    Permission.FieldEvidenceRead,
    Permission.AuditRead,
    Permission.UserRead,
    Permission.NotificationRead,
    Permission.SettingsManage,
  ],
  VERIFIER: [
    Permission.DashboardRead,
    Permission.CaseRead,
    Permission.DocumentRead,
    Permission.TaskRead,
    Permission.TaskWrite,
    Permission.ClarificationRead,
    Permission.ClarificationWrite,
    Permission.NotificationRead,
  ],
  QA_REVIEWER: [
    Permission.DashboardRead,
    Permission.CaseRead,
    Permission.DocumentRead,
    Permission.ClarificationRead,
    Permission.QaReview,
    Permission.ReportRead,
    Permission.ReportGenerate,
    Permission.FieldEvidenceRead,
    Permission.NotificationRead,
  ],
  CLIENT_ADMIN: [
    Permission.DashboardRead,
    Permission.CaseRead,
    Permission.CaseCreate,
    Permission.DocumentRead,
    Permission.DocumentWrite,
    Permission.ClarificationRead,
    Permission.ReportRead,
    Permission.NotificationRead,
  ],
  FIELD_EXECUTIVE: [
    Permission.CaseRead,
    Permission.FieldVisitRead,
    Permission.FieldVisitWrite,
    Permission.FieldEvidenceRead,
    Permission.NotificationRead,
  ],
  SALES_MANAGER: [
    Permission.DashboardRead,
    Permission.ClientRead,
    Permission.ClientWrite,
    Permission.CrmRead,
    Permission.CrmWrite,
    Permission.NotificationRead,
  ],
  FINANCE_MANAGER: [
    Permission.DashboardRead,
    Permission.ClientRead,
    Permission.FinanceRead,
    Permission.FinanceWrite,
    Permission.ReportRead,
    Permission.NotificationRead,
  ],
};

async function main(): Promise<void> {
  const configuredAdminEmail =
    process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const configuredTenantCode = process.env.SEED_TENANT_CODE?.trim();
  let existingTenant = await prisma.tenant.findUnique({
    where: { code: "SAPLING" },
    select: { id: true, code: true },
  });

  if (!existingTenant && configuredTenantCode) {
    existingTenant = await prisma.tenant.findUnique({
      where: { code: configuredTenantCode },
      select: { id: true, code: true },
    });
    if (!existingTenant) {
      throw new Error(`SEED_TENANT_CODE ${configuredTenantCode} was not found`);
    }
  }

  if (!existingTenant) {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, code: true },
      take: 2,
      orderBy: { id: "asc" },
    });
    if (tenants.length === 1) {
      existingTenant = tenants[0]!;
    } else if (tenants.length > 1) {
      throw new Error(
        "Multiple tenants exist; set SEED_TENANT_CODE to the tenant being rebranded",
      );
    }
  }

  if (!existingTenant && !configuredAdminEmail) {
    throw new Error("SEED_ADMIN_EMAIL is required for the first installation");
  }

  const tenant = existingTenant
    ? await prisma.tenant.update({
        where: { id: existingTenant.id },
        data: { code: "SAPLING", name: "Sapling Global" },
      })
    : await prisma.tenant.create({
        data: { code: "SAPLING", name: "Sapling Global" },
      });
  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "HQ" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "HQ",
      name: "Head Office",
      city: "Mumbai",
    },
  });
  const roles = new Map<string, bigint>();
  for (const [code, permissions] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { permissionsJson: JSON.stringify(permissions) },
      create: {
        tenantId: tenant.id,
        code,
        name: code.replaceAll("_", " "),
        permissionsJson: JSON.stringify(permissions),
        isSystem: true,
      },
    });
    roles.set(code, role.id);
  }

  await prisma.tenantFieldPolicy.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  });

  if (configuredAdminEmail) {
    const adminName =
      process.env.SEED_ADMIN_NAME?.trim() || "Platform Administrator";
    const existingAdmin = await prisma.user.findUnique({
      where: {
        tenantId_normalizedEmail: {
          tenantId: tenant.id,
          normalizedEmail: configuredAdminEmail,
        },
      },
      select: { id: true },
    });
    const resetPassword = process.env.SEED_RESET_ADMIN_PASSWORD === "true";
    let passwordHash: string | undefined;
    if (!existingAdmin || resetPassword) {
      const adminPassword = required("SEED_ADMIN_PASSWORD");
      if (adminPassword.length < 14) {
        throw new Error(
          "SEED_ADMIN_PASSWORD must contain at least 14 characters",
        );
      }
      passwordHash = await hashPassword(adminPassword);
    }

    const user = await prisma.user.upsert({
      where: {
        tenantId_normalizedEmail: {
          tenantId: tenant.id,
          normalizedEmail: configuredAdminEmail,
        },
      },
      update: {
        ...(process.env.SEED_ADMIN_NAME?.trim()
          ? { displayName: adminName }
          : {}),
        ...(passwordHash
          ? {
              passwordHash,
              failedLoginCount: 0,
              lockedUntil: null,
              passwordChangedAt: new Date(),
              mustChangePassword: false,
            }
          : {}),
      },
      create: {
        tenantId: tenant.id,
        branchId: branch.id,
        email: configuredAdminEmail,
        normalizedEmail: configuredAdminEmail,
        displayName: adminName,
        passwordHash: passwordHash!,
        mustChangePassword: false,
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: roles.get("PLATFORM_ADMIN")!,
        },
      },
      update: {},
      create: { userId: user.id, roleId: roles.get("PLATFORM_ADMIN")! },
    });
  }

  await prisma.servicePackage.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "STANDARD_BGV" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "STANDARD_BGV",
      name: "Standard BGV",
      checksJson: JSON.stringify([
        "IDENTITY",
        "ADDRESS",
        "EMPLOYMENT",
        "EDUCATION",
      ]),
      price: 2499,
      tatHours: 72,
    },
  });

  console.log("Sapling Global reference data synchronized.");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for production bootstrap`);
  return value;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

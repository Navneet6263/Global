import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { hashPassword } from "../src/auth/password";
import {
  isValidUserPassword,
  USER_PASSWORD_REQUIREMENTS,
} from "../src/auth/password-policy";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * UAT accounts: one login per role (and a Team Leader per verification team) on a test
 * company, so a tester can take one case from intake to the client's report. Safe to
 * re-run: existing UAT accounts are reset to the given password. Never in production.
 *
 *   UAT_USER_PASSWORD='...' npm run prisma:uat-users
 */
if (process.env.NODE_ENV === "production")
  throw new Error("UAT users cannot be provisioned in production");
if ((process.env.DB_NAME ?? "").trim().toLowerCase() === "sapling global")
  throw new Error(
    "Refusing to provision UAT users in the shared 'Sapling Global' database",
  );

const tenantCode = process.env.UAT_TENANT_CODE?.trim() || "SAPLING";
const domain =
  process.env.UAT_USER_DOMAIN?.trim().toLowerCase() || "sapling-uat.test";
const password = required("UAT_USER_PASSWORD");
if (!isValidUserPassword(password))
  throw new Error(`UAT_USER_PASSWORD ${USER_PASSWORD_REQUIREMENTS}`);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaMssql({
    server: required("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 1433),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    },
  }),
});

type Team = "DATA_ENTRY" | "EMPLOYMENT" | "EDUCATION" | "DIGITAL" | "VENDOR";
type Account = {
  local: string;
  name: string;
  roles: string[];
  team?: { type: Team; role: "LEAD" | "MEMBER" };
  company?: "admin" | "rm";
};

const ACCOUNTS: Account[] = [
  { local: "uat.admin", name: "UAT Platform Admin", roles: ["PLATFORM_ADMIN"] },
  { local: "uat.ops", name: "UAT Operations Manager", roles: ["OPS_MANAGER"] },
  {
    local: "uat.rm",
    name: "UAT Relationship Manager",
    roles: ["SPOC_RM"],
    company: "rm",
  },
  {
    local: "uat.dataentry",
    name: "UAT Data Entry",
    roles: ["DATA_ENTRY"],
    team: { type: "DATA_ENTRY", role: "MEMBER" },
  },
  {
    local: "uat.tl.employment",
    name: "UAT TL Employment",
    roles: ["VERIFIER"],
    team: { type: "EMPLOYMENT", role: "LEAD" },
  },
  {
    local: "uat.tl.education",
    name: "UAT TL Education",
    roles: ["VERIFIER"],
    team: { type: "EDUCATION", role: "LEAD" },
  },
  {
    local: "uat.tl.digital",
    name: "UAT TL Digital",
    roles: ["VERIFIER"],
    team: { type: "DIGITAL", role: "LEAD" },
  },
  {
    local: "uat.tl.vendor",
    name: "UAT TL Vendor",
    roles: ["VERIFIER"],
    team: { type: "VENDOR", role: "LEAD" },
  },
  {
    local: "uat.verifier",
    name: "UAT Verifier (Employment)",
    roles: ["VERIFIER"],
    team: { type: "EMPLOYMENT", role: "MEMBER" },
  },
  { local: "uat.qa", name: "UAT QA Reviewer", roles: ["QA_REVIEWER"] },
  {
    local: "uat.client",
    name: "UAT Client Admin",
    roles: ["CLIENT_ADMIN"],
    company: "admin",
  },
  {
    local: "uat.finance",
    name: "UAT Finance Manager",
    roles: ["FINANCE_MANAGER"],
  },
  { local: "uat.vendor", name: "UAT Vendor", roles: ["VENDOR"] },
  { local: "uat.sales", name: "UAT Sales Manager", roles: ["SALES_MANAGER"] },
];

const COMPANY_CODE = "UAT-TEST";

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { code: tenantCode },
    select: { id: true },
  });
  if (!tenant) throw new Error(`Tenant ${tenantCode} was not found`);
  const tenantId = tenant.id;

  const roles = await prisma.role.findMany({
    where: {
      tenantId,
      code: { in: [...new Set(ACCOUNTS.flatMap((a) => a.roles))] },
    },
    select: { id: true, code: true },
  });
  const roleId = new Map(roles.map((role) => [role.code, role.id]));
  const missing = ACCOUNTS.flatMap((a) => a.roles).filter(
    (code) => !roleId.has(code),
  );
  if (missing.length)
    throw new Error(`Missing roles: ${[...new Set(missing)].join(", ")}`);

  // Teams: reuse the active department of each type; create the Vendor team if missing.
  const departments = await prisma.department.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: { id: true, code: true, kind: true, teamType: true },
  });
  const teamDepartment = new Map<Team, bigint>();
  const dataEntry = departments.find((d) => d.kind === "DATA_ENTRY");
  if (dataEntry) teamDepartment.set("DATA_ENTRY", dataEntry.id);
  for (const type of [
    "EMPLOYMENT",
    "EDUCATION",
    "DIGITAL",
    "VENDOR",
  ] as const) {
    const found = departments.find(
      (d) => d.kind === "VERIFICATION" && d.teamType === type,
    );
    if (found) teamDepartment.set(type, found.id);
  }
  if (!teamDepartment.has("VENDOR")) {
    const created = await prisma.department.create({
      data: {
        tenantId,
        code: "VENDOR",
        name: "Vendor",
        kind: "VERIFICATION",
        teamType: "VENDOR",
        checkTypesJson: JSON.stringify(["ADDRESS", "CRIMINAL", "COURT_RECORD"]),
      },
      select: { id: true },
    });
    teamDepartment.set("VENDOR", created.id);
  }
  if (!teamDepartment.has("DATA_ENTRY"))
    teamDepartment.set(
      "DATA_ENTRY",
      (
        await prisma.department.create({
          data: {
            tenantId,
            code: "DATA_ENTRY",
            name: "Data Entry",
            kind: "DATA_ENTRY",
          },
          select: { id: true },
        })
      ).id,
    );
  for (const type of ["EMPLOYMENT", "EDUCATION", "DIGITAL"] as const)
    if (!teamDepartment.has(type))
      teamDepartment.set(
        type,
        (
          await prisma.department.create({
            data: {
              tenantId,
              code: type,
              name: type.charAt(0) + type.slice(1).toLowerCase(),
              kind: "VERIFICATION",
              teamType: type,
            },
            select: { id: true },
          })
        ).id,
      );

  // The test company.
  const company =
    (await prisma.client.findFirst({
      where: { tenantId, code: COMPANY_CODE },
      select: { id: true, displayName: true },
    })) ??
    (await prisma.client.create({
      data: {
        tenantId,
        code: COMPANY_CODE,
        legalName: "UAT Test Company Pvt. Ltd.",
        displayName: "UAT Test Company",
        contactName: "UAT Client Admin",
        contactEmail: `uat.client@${domain}`,
        status: "ACTIVE",
        billingTerms: "Monthly, 15 days",
        billingAddress: "UAT test address, Pune",
        slaHours: 72,
      },
      select: { id: true, displayName: true },
    }));

  const passwordHash = await hashPassword(password);
  const result: Array<{ login: string; roles: string; team: string }> = [];
  let rmUserId: bigint | undefined;
  for (const account of ACCOUNTS) {
    const email = `${account.local}@${domain}`;
    const existing = await prisma.user.findUnique({
      where: { tenantId_normalizedEmail: { tenantId, normalizedEmail: email } },
      select: { id: true },
    });
    const clientId = account.company === "admin" ? company.id : null;
    const user = await prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              displayName: account.name,
              clientId,
              branchId: null,
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
              tenantId,
              clientId,
              email,
              normalizedEmail: email,
              displayName: account.name,
              passwordHash,
              mustChangePassword: false,
              status: "ACTIVE",
            },
            select: { id: true, publicId: true },
          });
      await tx.userRole.deleteMany({ where: { userId: saved.id } });
      await tx.userRole.createMany({
        data: account.roles.map((code) => ({
          userId: saved.id,
          roleId: roleId.get(code)!,
        })),
      });
      await tx.departmentMember.deleteMany({ where: { userId: saved.id } });
      if (account.team)
        await tx.departmentMember.create({
          data: {
            departmentId: teamDepartment.get(account.team.type)!,
            userId: saved.id,
            role: account.team.role,
          },
        });
      await tx.spocClientScope.deleteMany({ where: { userId: saved.id } });
      if (account.company === "rm")
        await tx.spocClientScope.create({
          data: { userId: saved.id, clientId: company.id },
        });
      await tx.refreshSession.updateMany({
        where: { userId: saved.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          action: existing ? "uat-user.reset" : "uat-user.created",
          resourceType: "user",
          resourcePublicId: saved.publicId,
          afterJson: JSON.stringify({
            email,
            roles: account.roles,
            team: account.team ?? null,
          }),
        },
      });
      return saved;
    });
    if (account.company === "rm") rmUserId = user.id;
    result.push({
      login: email,
      roles: account.roles.join(", "),
      team: account.team ? `${account.team.type} ${account.team.role}` : "",
    });
  }
  // The UAT RM owns the test company: its new cases go to this RM.
  if (rmUserId)
    await prisma.client.update({
      where: { id: company.id },
      data: { primaryRmUserId: rmUserId, primaryRmAssignedAt: new Date() },
    });
  console.log(
    JSON.stringify(
      {
        company: company.displayName,
        passwordChangeRequired: false,
        accounts: result,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

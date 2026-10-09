import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import type { PrismaService } from "../database/prisma.service";

/** Roles an Operations Manager may create while a Platform Admin enables delegation. */
export const OPS_CREATABLE_ROLES: readonly string[] = [
  "VERIFIER",
  "FIELD_EXECUTIVE",
  "QA_REVIEWER",
  "CLIENT_ADMIN",
  "SPOC_RM",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "VENDOR",
  "SUPPORT_AGENT",
  "DATA_ENTRY",
];

/** Roles whose existing scope includes an operating branch (see frontend ROLE_DEFINITIONS). */
const BRANCH_SCOPED_ROLES: readonly string[] = [
  "VERIFIER",
  "FIELD_EXECUTIVE",
  "QA_REVIEWER",
  "FINANCE_MANAGER",
  "DATA_ENTRY",
];

export type UserCreationPath = "ADMIN" | "OPERATIONS";

export async function opsUserCreationEnabled(
  prisma: PrismaService,
  tenantId: bigint,
): Promise<boolean> {
  const policy = await prisma.tenantAccessPolicy.findUnique({
    where: { tenantId },
    select: { opsUserCreationEnabled: true },
  });
  return policy?.opsUserCreationEnabled === true;
}

/**
 * Server-side gate for POST /users. Platform admins keep the existing path; an
 * Operations Manager may create only delegated roles, only inside its own branch,
 * and only while the tenant access policy is ON (read on every request).
 */
export async function assertCanCreateUser(
  prisma: PrismaService,
  actor: Actor,
  input: { roleCodes: readonly string[]; branchId?: string },
): Promise<UserCreationPath> {
  if (actor.roles.includes("PLATFORM_ADMIN")) {
    if (
      !actor.permissions.includes("*") &&
      !actor.permissions.includes(Permission.UserWrite)
    )
      throw new ForbiddenException(
        "You do not have permission to create users",
      );
    return "ADMIN";
  }
  if (!actor.roles.includes("OPS_MANAGER"))
    throw new ForbiddenException("Only administrators can create user IDs");
  if (!(await opsUserCreationEnabled(prisma, actor.tenantId)))
    throw new ForbiddenException(
      "User creation is not enabled for Operations Managers",
    );
  const denied = input.roleCodes.filter(
    (code) => !OPS_CREATABLE_ROLES.includes(code),
  );
  if (denied.length)
    throw new ForbiddenException(
      `Operations Managers cannot create ${denied.join(", ")} users`,
    );
  // A tenant-wide Ops Manager may assign any active branch (checked by the existing lookup).
  if (!actor.branchId) return "OPERATIONS";
  const own = actor.branchPublicId?.toLowerCase();
  if (!own || (input.branchId && input.branchId.toLowerCase() !== own))
    throw new ForbiddenException("You can only assign your own branch");
  if (
    !input.branchId &&
    input.roleCodes.some((code) => BRANCH_SCOPED_ROLES.includes(code))
  )
    throw new ForbiddenException(
      "Assign your own branch; all-branch access needs a Platform Admin",
    );
  return "OPERATIONS";
}

/**
 * Server-side gate for changing an existing ID (roles, status, password). Platform admins
 * keep their path; an Operations Manager may change only IDs it could create (never an
 * admin or another Ops Manager), only to roles it could give, and only while the admin
 * switch is ON. `current` / `next` are the roles the person works as (custom → base).
 */
export async function assertCanManageUser(
  prisma: PrismaService,
  actor: Actor,
  current: readonly string[],
  next: readonly string[] = current,
): Promise<UserCreationPath> {
  if (actor.roles.includes("PLATFORM_ADMIN")) {
    if (
      !actor.permissions.includes("*") &&
      !actor.permissions.includes(Permission.UserWrite)
    )
      throw new ForbiddenException(
        "You do not have permission to change user IDs",
      );
    return "ADMIN";
  }
  if (!actor.roles.includes("OPS_MANAGER"))
    throw new ForbiddenException("Only administrators can change user IDs");
  if (!(await opsUserCreationEnabled(prisma, actor.tenantId)))
    throw new ForbiddenException(
      "Changing user IDs is not enabled for Operations Managers",
    );
  const outside = [
    ...new Set(
      [...current, ...next].filter(
        (code) => !OPS_CREATABLE_ROLES.includes(code),
      ),
    ),
  ];
  if (outside.length)
    throw new ForbiddenException(
      `Operations Managers cannot change ${outside.join(", ")} access`,
    );
  return "OPERATIONS";
}

/** What the current actor may create, so the UI never keeps its own copy of these rules. */
export async function userCreationPolicy(prisma: PrismaService, actor: Actor) {
  const isAdmin = actor.roles.includes("PLATFORM_ADMIN");
  const enabled =
    isAdmin ||
    (actor.roles.includes("OPS_MANAGER") &&
      (await opsUserCreationEnabled(prisma, actor.tenantId)));
  if (!enabled)
    return { enabled, roles: [], branches: [], tenantWideAllowed: false };
  const branchScoped = !isAdmin && Boolean(actor.branchId);
  const [roles, branches] = await Promise.all([
    isAdmin
      ? prisma.role
          .findMany({
            where: { tenantId: actor.tenantId },
            select: { code: true },
          })
          .then((rows) => rows.map((row) => row.code))
      : [...OPS_CREATABLE_ROLES],
    prisma.branch.findMany({
      where: {
        tenantId: actor.tenantId,
        isActive: true,
        ...(branchScoped ? { id: actor.branchId } : {}),
      },
      select: { publicId: true, name: true, city: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    enabled,
    roles,
    branches: branches.map(({ publicId, ...branch }) => ({
      id: publicId,
      ...branch,
    })),
    tenantWideAllowed: !branchScoped,
  };
}

import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * The one place a user account row is written, its password reset or its sessions
 * revoked. Admin/Ops creation (UsersService) and Vendor team management both use it,
 * so validation, hashing, session revocation and audit never drift apart.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function assertEmailAvailable(
  db: Pick<Tx, "user">,
  tenantId: bigint,
  email: string,
) {
  const exists = await db.user.findFirst({
    where: { tenantId, normalizedEmail: normalizeEmail(email) },
    select: { id: true },
  });
  if (exists)
    throw new ConflictException("A user with this email already exists");
}

export async function resolveRoles(
  db: Pick<Tx, "role">,
  tenantId: bigint,
  codes: readonly string[],
) {
  const unique = [...new Set(codes)];
  const roles = await db.role.findMany({
    where: { tenantId, code: { in: unique } },
    select: { id: true, code: true },
  });
  if (roles.length !== unique.length)
    throw new NotFoundException("One or more roles were not found");
  return roles;
}

export const createdAccountSelect = {
  publicId: true,
  email: true,
  displayName: true,
  status: true,
  mustChangePassword: true,
  version: true,
  createdAt: true,
} as const;

export interface NewAccount {
  tenantId: bigint;
  actorUserId: bigint;
  email: string;
  displayName: string;
  phone?: string;
  passwordHash: string;
  roles: ReadonlyArray<{ id: bigint; code: string }>;
  branchId?: bigint;
  clientId?: bigint;
  spocClientIds?: readonly bigint[];
  vendorOwnerId?: bigint;
  /** Extra facts for the user.created audit row (createdVia, clients, owner). */
  audit?: Record<string, unknown>;
}

/** Writes the account with its roles (and scopes) plus the user.created audit row. */
export async function insertUserAccount(tx: Tx, account: NewAccount) {
  const row = await tx.user.create({
    data: {
      tenantId: account.tenantId,
      branchId: account.branchId,
      clientId: account.clientId,
      vendorOwnerId: account.vendorOwnerId,
      email: account.email.trim(),
      normalizedEmail: normalizeEmail(account.email),
      displayName: account.displayName.trim(),
      phone: account.phone?.trim(),
      passwordHash: account.passwordHash,
      mustChangePassword: true,
      userRoles: {
        create: account.roles.map((role) => ({ roleId: role.id })),
      },
      ...(account.spocClientIds?.length
        ? {
            spocClientScopes: {
              create: account.spocClientIds.map((clientId) => ({ clientId })),
            },
          }
        : {}),
    },
    select: createdAccountSelect,
  });
  await tx.auditEvent.create({
    data: {
      tenantId: account.tenantId,
      actorUserId: account.actorUserId,
      action: "user.created",
      resourceType: "user",
      resourcePublicId: row.publicId,
      afterJson: JSON.stringify({
        email: row.email,
        roles: account.roles.map((role) => role.code),
        ...account.audit,
      }),
    },
  });
  return row;
}

export function revokeSessions(tx: Pick<Tx, "refreshSession">, userId: bigint) {
  return tx.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * New temporary password (hashed by the caller, outside the transaction): it must be
 * changed at the next sign-in, and every existing session ends.
 */
export async function resetAccountPassword(
  tx: Tx,
  target: {
    tenantId: bigint;
    actorUserId: bigint;
    userId: bigint;
    publicId: string;
    passwordHash: string;
    audit?: Record<string, unknown>;
  },
) {
  await tx.user.update({
    where: { id: target.userId },
    data: {
      passwordHash: target.passwordHash,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      version: { increment: 1 },
    },
  });
  await revokeSessions(tx, target.userId);
  await tx.auditEvent.create({
    data: {
      tenantId: target.tenantId,
      actorUserId: target.actorUserId,
      action: "user.password.reset",
      resourceType: "user",
      resourcePublicId: target.publicId,
      ...(target.audit ? { afterJson: JSON.stringify(target.audit) } : {}),
    },
  });
}

import { ConflictException, ForbiddenException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import { notifyDelegationsReturned } from "./vendor-team-notify";

type Tx = Prisma.TransactionClient;

/** Highest per-vendor limit a Platform Admin can set. */
export const VENDOR_TEAM_MAX_LIMIT = 50;

/** One reminder per request per hour, so a team user is not spammed. */
export const REMINDER_INTERVAL_MS = 60 * 60_000;

export function canRemindNow(
  lastRemindedAt: Date | null,
  now = new Date(),
): boolean {
  return (
    !lastRemindedAt ||
    now.getTime() - lastRemindedAt.getTime() >= REMINDER_INTERVAL_MS
  );
}

/** Only ACTIVE team logins count toward the limit; SUSPENDED ones free their slot. */
export function activeTeamWhere(tenantId: bigint, ownerId: bigint) {
  return { tenantId, vendorOwnerId: ownerId, status: "ACTIVE" };
}

export function teamLimitMessage(limit: number): string {
  return limit
    ? `The team limit (${limit} active user${limit === 1 ? "" : "s"}) is reached; suspend a team user or ask the Platform Admin to raise it`
    : "Team users are not enabled for this vendor; ask the Platform Admin to set a limit";
}

/**
 * Call inside the transaction that will add or reactivate a team login. The Main
 * Vendor row is locked first (a write, like lockMutableCaseEvidence), so concurrent
 * creates for the same vendor queue and each sees the others' result; then the
 * ACTIVE team count must stay below the Admin limit. Active users never exceed it.
 */
export async function assertTeamCapacity(
  tx: Tx,
  tenantId: bigint,
  ownerId: bigint,
) {
  const locked = await tx.user.updateMany({
    where: {
      id: ownerId,
      tenantId,
      status: "ACTIVE",
      vendorOwnerId: null,
      userRoles: { some: { role: { code: "VENDOR" } } },
    },
    data: { updatedAt: new Date() },
  });
  if (locked.count !== 1)
    throw new ForbiddenException("The main vendor account is not active");
  const [policy, active] = await Promise.all([
    tx.vendorTeamPolicy.findUnique({
      where: { vendorUserId: ownerId },
      select: { maxActiveUsers: true },
    }),
    tx.user.count({ where: activeTeamWhere(tenantId, ownerId) }),
  ]);
  const limit = policy?.maxActiveUsers ?? 0;
  if (active >= limit) throw new ConflictException(teamLimitMessage(limit));
  return { limit, active };
}

/**
 * A team login stopped working (suspended or no longer a vendor): its PENDING
 * delegated requests go back to the Main Vendor, who is told how many came back.
 */
export async function releaseDelegations(
  tx: Tx,
  input: {
    tenantId: bigint;
    ownerId: bigint;
    memberId: bigint;
    memberName: string;
  },
) {
  const released = await tx.vendorAssignment.updateMany({
    where: {
      tenantId: input.tenantId,
      handlerUserId: input.memberId,
      status: "PENDING",
    },
    data: { handlerUserId: null, delegatedAt: null, version: { increment: 1 } },
  });
  if (released.count)
    await notifyDelegationsReturned(tx, {
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      memberName: input.memberName,
      count: released.count,
    });
  return released.count;
}

/**
 * Team rules on Platform Admin edits (PATCH /users/:id), inside its transaction:
 * reactivating a team user must fit the limit; suspending or removing its VENDOR role
 * returns its work; a Main Vendor with active team users cannot stop being a vendor.
 */
export async function applyVendorTeamRulesOnEdit(
  tx: Tx,
  input: {
    tenantId: bigint;
    user: {
      id: bigint;
      status: string;
      displayName: string;
      vendorOwnerId?: bigint | null;
    };
    wasVendor: boolean;
    staysVendor: boolean;
    nextStatus: string;
  },
) {
  const { user } = input;
  const ownerId = user.vendorOwnerId ?? null;
  if (ownerId === null) {
    if (input.wasVendor && !input.staysVendor) {
      const team = await tx.user.count({
        where: activeTeamWhere(input.tenantId, user.id),
      });
      if (team)
        throw new ConflictException(
          "This vendor still has active team users; suspend them before changing its role",
        );
    }
    return { clearOwner: false };
  }
  const member = {
    tenantId: input.tenantId,
    ownerId,
    memberId: user.id,
    memberName: user.displayName,
  };
  if (!input.staysVendor) {
    await releaseDelegations(tx, member);
    return { clearOwner: true };
  }
  if (user.status !== "ACTIVE" && input.nextStatus === "ACTIVE")
    await assertTeamCapacity(tx, input.tenantId, ownerId);
  if (user.status === "ACTIVE" && input.nextStatus !== "ACTIVE")
    await releaseDelegations(tx, member);
  return { clearOwner: false };
}

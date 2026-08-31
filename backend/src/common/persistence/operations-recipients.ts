import type { Prisma } from "../../generated/prisma/client";

type OperationsRecipientTarget = {
  tenantId: bigint;
  branchId?: bigint | null;
  clientId?: bigint | null;
  assignedUserId?: bigint | null;
};

const operationsRole = {
  some: { role: { code: "OPS_MANAGER" } },
} as const;

/**
 * Prefer the current, active case owner. If ownership is stale or absent,
 * notify only tenant-wide operations users and users assigned to the case's
 * branch; never disclose case activity to a different branch.
 */
export async function activeOperationsRecipients(
  tx: Prisma.TransactionClient,
  target: OperationsRecipientTarget,
) {
  if (target.assignedUserId) {
    const owner = await tx.user.findMany({
      where: {
        id: target.assignedUserId,
        tenantId: target.tenantId,
        status: "ACTIVE",
        AND: [
          target.branchId
            ? { OR: [{ branchId: target.branchId }, { branchId: null }] }
            : { branchId: null },
          target.clientId
            ? { OR: [{ clientId: target.clientId }, { clientId: null }] }
            : { clientId: null },
        ],
        userRoles: operationsRole,
      },
      select: { id: true },
    });
    if (owner.length) return owner;
  }

  return tx.user.findMany({
    where: {
      tenantId: target.tenantId,
      status: "ACTIVE",
      ...(target.branchId
        ? { OR: [{ branchId: target.branchId }, { branchId: null }] }
        : { branchId: null }),
      ...(target.clientId
        ? {
            AND: [{ OR: [{ clientId: target.clientId }, { clientId: null }] }],
          }
        : { clientId: null }),
      userRoles: operationsRole,
    },
    select: { id: true },
  });
}

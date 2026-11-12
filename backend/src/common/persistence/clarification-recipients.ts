import type { Prisma } from "../../generated/prisma/client";
import { activeOperationsRecipients } from "./operations-recipients";

export type ClarificationStakeholderTarget = {
  tenantId: bigint;
  branchId?: bigint | null;
  clientId?: bigint | null;
  assignedUserId?: bigint | null;
  raisedById?: bigint | null;
  opsReviewedById?: bigint | null;
  excludeUserId?: bigint | null;
};

export type ClarificationRecipientSplit = {
  opsUserIds: bigint[];
  rmUserIds: bigint[];
  allUserIds: bigint[];
};

/**
 * Resolve every active internal stakeholder for a clarification event without
 * crossing tenant, branch, or Client-to-RM boundaries:
 * - Active OPS_MANAGER users matching case branch/client scope
 * - Active SPOC_RM users mapped to the case's client via SpocClientScope
 * - Explicit active internal actors already linked to the case/clarification
 */
export async function resolveClarificationStakeholders(
  tx: Prisma.TransactionClient,
  target: ClarificationStakeholderTarget,
): Promise<ClarificationRecipientSplit> {
  if (typeof tx.user?.findMany !== "function") {
    return { opsUserIds: [], rmUserIds: [], allUserIds: [] };
  }

  const ops = await activeOperationsRecipients(tx, {
    tenantId: target.tenantId,
    branchId: target.branchId,
    clientId: target.clientId,
    assignedUserId: target.assignedUserId,
  });

  const rmWhere: Prisma.UserWhereInput | null = target.clientId
    ? {
        tenantId: target.tenantId,
        status: "ACTIVE",
        userRoles: { some: { role: { code: "SPOC_RM" } } },
        spocClientScopes: { some: { clientId: target.clientId } },
      }
    : null;

  const extraIds = [
    target.assignedUserId,
    target.raisedById,
    target.opsReviewedById,
  ].filter((id): id is bigint => id != null);

  const [rms, extras] = await Promise.all([
    rmWhere
      ? tx.user.findMany({ where: rmWhere, select: { id: true } })
      : Promise.resolve([]),
    extraIds.length
      ? tx.user.findMany({
          where: {
            id: { in: extraIds },
            tenantId: target.tenantId,
            status: "ACTIVE",
            userRoles: {
              some: { role: { code: { in: ["OPS_MANAGER", "SPOC_RM"] } } },
            },
          },
          select: {
            id: true,
            userRoles: { select: { role: { select: { code: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const exclude = target.excludeUserId;
  const opsSet = new Set<bigint>(ops.map((u) => u.id));
  const rmSet = new Set<bigint>(rms.map((u) => u.id));

  for (const user of extras) {
    const codes = (user.userRoles ?? []).map((r) => r.role.code);
    if (codes.includes("SPOC_RM") && !codes.includes("OPS_MANAGER")) {
      rmSet.add(user.id);
    } else if (codes.includes("OPS_MANAGER")) {
      opsSet.add(user.id);
    }
  }

  if (exclude != null) {
    opsSet.delete(exclude);
    rmSet.delete(exclude);
  }

  // If a user holds OPS_MANAGER, route to Ops href once rather than sending duplicate notifications.
  for (const id of opsSet) rmSet.delete(id);

  const opsUserIds = [...opsSet];
  const rmUserIds = [...rmSet];
  return {
    opsUserIds,
    rmUserIds,
    allUserIds: [...opsUserIds, ...rmUserIds],
  };
}

export async function notifyClarificationStakeholders(
  tx: Prisma.TransactionClient,
  input: ClarificationStakeholderTarget & {
    type: string;
    title: string;
    body: string;
    opsHref: string;
    rmHref: string;
  },
) {
  if (typeof tx.notification?.createMany !== "function") {
    return { opsUserIds: [], rmUserIds: [], allUserIds: [] };
  }
  const split = await resolveClarificationStakeholders(tx, input);
  const rows = [
    ...split.opsUserIds.map((userId) => ({
      tenantId: input.tenantId,
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.opsHref,
    })),
    ...split.rmUserIds.map((userId) => ({
      tenantId: input.tenantId,
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.rmHref,
    })),
  ];
  if (rows.length) {
    await tx.notification.createMany({ data: rows });
  }
  return split;
}

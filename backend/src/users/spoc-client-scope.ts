import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";

type ClientReader = Pick<Prisma.TransactionClient, "client">;

export interface ScopeClient {
  id: bigint;
  publicId: string;
  displayName: string;
}

/**
 * SPOC-RM takes a list of client workspaces (SpocClientScope) and never the single
 * User.clientId; every other role keeps its existing single-client field only.
 */
export function assertSpocClientInput(
  roleCodes: readonly string[],
  input: { clientId?: string; spocClientIds?: readonly string[] },
): void {
  if (!roleCodes.includes("SPOC_RM")) {
    if (input.spocClientIds !== undefined)
      throw new ConflictException(
        "Only SPOC-RM users can be assigned multiple client workspaces",
      );
    return;
  }
  if (input.clientId)
    throw new ConflictException(
      "SPOC-RM users take a list of client workspaces, not a single client",
    );
  // No company is fine: an RM can be created first and given companies later.
}

/** Companies an RM may look after: live ones and those still onboarding. */
const ASSIGNABLE_STATUSES: readonly string[] = ["ACTIVE", "ONBOARDING"];

/**
 * Resolves client IDs inside the actor's tenant. A newly assigned client must be
 * ACTIVE or ONBOARDING (the RM helps a new company go live); clients the user already
 * had (`keep`) stay allowed whatever their status.
 */
export async function resolveScopeClients(
  db: ClientReader,
  tenantId: bigint,
  publicIds: readonly string[],
  keep: readonly bigint[] = [],
): Promise<ScopeClient[]> {
  const wanted = [...new Set(publicIds.map((id) => id.toLowerCase()))];
  const rows = await db.client.findMany({
    where: { tenantId, publicId: { in: wanted } },
    select: { id: true, publicId: true, displayName: true, status: true },
    orderBy: { displayName: "asc" },
  });
  if (rows.length !== wanted.length)
    throw new NotFoundException("One or more client workspaces were not found");
  const inactive = rows.filter(
    (row) =>
      !ASSIGNABLE_STATUSES.includes(row.status) && !keep.includes(row.id),
  );
  if (inactive.length)
    throw new ConflictException(
      `These companies are suspended or closed and cannot be assigned: ${inactive.map((row) => row.displayName).join(", ")}`,
    );
  return rows.map(({ id, publicId, displayName }) => ({
    id,
    publicId,
    displayName,
  }));
}

/**
 * A company picked for an RM gets that RM as its company RM when it has none yet, so the
 * dashboards, onboarding and client pages show the same RM. A company that already has an
 * RM is left alone; change it in Companies & RMs. Every change is audited.
 */
export async function claimCompaniesWithoutRm(
  tx: Pick<Prisma.TransactionClient, "client" | "user" | "auditEvent">,
  input: {
    tenantId: bigint;
    actorUserId: bigint;
    rmPublicId: string;
    clientIds: readonly bigint[];
  },
): Promise<string[]> {
  if (!input.clientIds.length) return [];
  const rm = await tx.user.findFirst({
    where: { tenantId: input.tenantId, publicId: input.rmPublicId },
    select: { id: true, displayName: true },
  });
  if (!rm) return [];
  const open = await tx.client.findMany({
    where: {
      tenantId: input.tenantId,
      id: { in: [...input.clientIds] },
      primaryRmUserId: null,
    },
    select: { id: true, publicId: true, displayName: true, version: true },
  });
  const claimed: string[] = [];
  for (const client of open) {
    const updated = await tx.client.updateMany({
      where: { id: client.id, primaryRmUserId: null, version: client.version },
      data: {
        primaryRmUserId: rm.id,
        primaryRmAssignedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) continue;
    claimed.push(client.displayName);
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "client.primary-rm-assigned",
        resourceType: "client",
        resourcePublicId: client.publicId,
        beforeJson: JSON.stringify({ primaryRmId: null }),
        afterJson: JSON.stringify({
          primaryRmId: input.rmPublicId,
          primaryRmName: rm.displayName,
          reason: "Company selected on the RM's user ID",
        }),
      },
    });
  }
  return claimed;
}

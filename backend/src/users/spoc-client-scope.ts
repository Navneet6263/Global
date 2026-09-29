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
  if (!input.spocClientIds?.length)
    throw new ConflictException(
      "SPOC-RM users must be assigned at least one client workspace",
    );
}

/**
 * Resolves client IDs inside the actor's tenant. A newly assigned client must be
 * ACTIVE; clients the user already had (`keep`) stay allowed whatever their status.
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
    (row) => row.status !== "ACTIVE" && !keep.includes(row.id),
  );
  if (inactive.length)
    throw new NotFoundException(
      `Active client not found: ${inactive.map((row) => row.displayName).join(", ")}`,
    );
  return rows.map(({ id, publicId, displayName }) => ({
    id,
    publicId,
    displayName,
  }));
}

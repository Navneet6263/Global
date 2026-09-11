import type { Prisma } from "../generated/prisma/client";

/** Shared by the picker and write validation; never use the operator's own branch. */
export function fieldAssigneeScope(
  tenantId: bigint,
  scope: { branchId: bigint | null; clientId: bigint },
): Prisma.UserWhereInput {
  return {
    tenantId,
    status: "ACTIVE",
    AND: [
      scope.branchId
        ? { OR: [{ branchId: scope.branchId }, { branchId: null }] }
        : { branchId: null },
      { OR: [{ clientId: null }, { clientId: scope.clientId }] },
    ],
    userRoles: { some: { role: { code: "FIELD_EXECUTIVE" } } },
  };
}

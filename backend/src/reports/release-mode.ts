import type { Prisma } from "../generated/prisma/client";

/**
 * Tenant release mode. ON (default): the report goes to the client right after QC and
 * manager approval, and billing is monthly. OFF: the report waits for full payment.
 */
export async function releaseBeforePayment(
  db: Pick<Prisma.TransactionClient, "tenantAccessPolicy">,
  tenantId: bigint,
) {
  const policy = await db.tenantAccessPolicy.findUnique({
    where: { tenantId },
    select: { releaseBeforePayment: true },
  });
  return policy?.releaseBeforePayment ?? true;
}

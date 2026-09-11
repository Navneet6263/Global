import type { Prisma } from "../generated/prisma/client";

export async function restartCheckMethods(
  tx: Prisma.TransactionClient,
  checkId: bigint,
  actorUserId: bigint,
) {
  const methods = await tx.verificationMethodRun.findMany({
    where: { checkId, status: { not: "SUPERSEDED" } },
    orderBy: { createdAt: "desc" },
  });
  await tx.verificationMethodRun.updateMany({
    where: { checkId, status: { not: "SUPERSEDED" } },
    data: { status: "SUPERSEDED", version: { increment: 1 } },
  });
  const renewed = new Set<string>();
  for (const method of methods) {
    if (renewed.has(method.method)) continue;
    renewed.add(method.method);
    await tx.verificationMethodRun.create({
      data: {
        checkId,
        method: method.method,
        status: "REQUESTED",
        provider: method.provider,
        sourceContact: method.sourceContact,
        dueAt: method.dueAt,
        requestedAt: new Date(),
        createdById: actorUserId,
      },
    });
  }
  return renewed.size;
}

import type { Prisma } from "../../generated/prisma/client";
import type { Actor } from "./actor";

// Requesting a source only routes work. Recording its factual response makes
// the actor a maker, including historical cycles retained for the same case.
export async function hasRecordedCaseSource(
  tx: Pick<Prisma.TransactionClient, "auditEvent">,
  actor: Actor,
  casePublicId: string,
) {
  return Boolean(
    await tx.auditEvent.findFirst({
      where: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        resourceType: "case",
        resourcePublicId: casePublicId,
        action: "verification.method-responded",
      },
      select: { id: true },
    }),
  );
}

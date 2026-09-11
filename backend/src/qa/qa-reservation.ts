import { ConflictException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import { claimCutoff } from "./qa-claim";
import { fieldQaWhere } from "../field-visits/physical-field-policy";

export async function changeReservation(
  prisma: PrismaService,
  actor: Actor,
  caseId: string,
  caseVersion: number,
  action: "renew" | "release",
) {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const result = await tx.verificationCase.updateMany({
      where: {
        tenantId: actor.tenantId,
        publicId: caseId,
        status: "QA_REVIEW",
        version: caseVersion,
        qaReviewerId: actor.userId,
        ...(actor.branchId ? { branchId: actor.branchId } : {}),
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
        ...(action === "renew"
          ? { qaClaimedAt: { gt: claimCutoff(now) }, AND: [fieldQaWhere()] }
          : {}),
      },
      data: {
        qaReviewerId: action === "release" ? null : actor.userId,
        qaClaimedAt: action === "release" ? null : now,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new ConflictException(
        "Reservation changed or expired; refresh and claim the case again",
      );
    await tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: `qa.reservation-${action === "renew" ? "renewed" : "released"}`,
        resourceType: "case",
        resourcePublicId: caseId,
      },
    });
  });
  return { id: caseId, caseVersion: caseVersion + 1 };
}

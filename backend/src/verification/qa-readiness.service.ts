import { Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";

type QaReadinessTarget = {
  tenantId: bigint;
  caseId: bigint;
  casePublicId: string;
  branchId?: bigint | null;
  clientId?: bigint | null;
  changedById: bigint;
  fromStatus: "IN_PROGRESS" | "CLARIFICATION_PENDING";
  reason: string;
  completedTaskId?: string;
};

@Injectable()
export class QaReadinessService {
  async promoteIfReady(
    tx: Prisma.TransactionClient,
    target: QaReadinessTarget,
  ): Promise<boolean> {
    const unfinishedChecks = await tx.caseCheck.count({
      where: { caseId: target.caseId, status: { not: "COMPLETED" } },
    });
    if (unfinishedChecks) return false;

    const promoted = await tx.verificationCase.updateMany({
      where: { id: target.caseId, status: target.fromStatus },
      data: { status: "QA_REVIEW", version: { increment: 1 } },
    });
    if (promoted.count !== 1) return false;

    await tx.caseStatusHistory.create({
      data: {
        caseId: target.caseId,
        fromStatus: target.fromStatus,
        toStatus: "QA_REVIEW",
        changedById: target.changedById,
        reason: target.reason,
      },
    });
    await tx.outboxEvent.create({
      data: {
        tenantId: target.tenantId,
        topic: "verification.case.ready-for-qa",
        aggregateType: "case",
        aggregateId: target.casePublicId,
        payloadJson: JSON.stringify({
          caseId: target.casePublicId,
          completedTaskId: target.completedTaskId,
        }),
      },
    });

    const reviewers = await tx.user.findMany({
      where: {
        tenantId: target.tenantId,
        status: "ACTIVE",
        ...(target.branchId
          ? { OR: [{ branchId: target.branchId }, { branchId: null }] }
          : { branchId: null }),
        ...(target.clientId
          ? {
              AND: [
                { OR: [{ clientId: target.clientId }, { clientId: null }] },
              ],
            }
          : { clientId: null }),
        userRoles: {
          some: { role: { code: { in: ["QA_REVIEWER", "OPS_MANAGER"] } } },
        },
      },
      select: { id: true },
    });
    if (reviewers.length) {
      await tx.notification.createMany({
        data: reviewers.map((reviewer) => ({
          tenantId: target.tenantId,
          userId: reviewer.id,
          type: "QA_READY",
          title: "Case ready for QA",
          body: "All verification checks are complete and awaiting independent review.",
          href: `/cases/${target.casePublicId}`,
        })),
      });
    }
    return true;
  }
}

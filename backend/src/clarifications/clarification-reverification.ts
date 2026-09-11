import type { Actor } from "../common/auth/actor";
import type { Prisma } from "../generated/prisma/client";
import { updateCaseRisk } from "../verification/case-risk";
import { restartCheckMethods } from "../verification/restart-check-methods";

export async function requestClarificationReverification(
  tx: Prisma.TransactionClient,
  actor: Actor,
  target: { caseId: bigint; checkId: bigint | null; subject: string },
) {
  const checks = await tx.caseCheck.findMany({
    where: {
      caseId: target.caseId,
      ...(target.checkId ? { id: target.checkId } : {}),
    },
    include: { tasks: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  for (const check of checks) {
    const previous = check.tasks[0];
    const assignee = previous?.assigneeId
      ? await tx.user.findFirst({
          where: {
            id: previous.assigneeId,
            tenantId: actor.tenantId,
            status: "ACTIVE",
          },
          select: { id: true },
        })
      : null;
    await tx.caseCheck.update({
      where: { id: check.id },
      data: {
        status: assignee ? "ASSIGNED" : "PENDING",
        result: null,
        riskLevel: null,
        sourceSummary: null,
        completedAt: null,
        version: { increment: 1 },
      },
    });
    await restartCheckMethods(tx, check.id, actor.userId);
    const activeTask =
      previous &&
      ["OPEN", "UNASSIGNED", "IN_PROGRESS", "BLOCKED"].includes(
        previous.status,
      );
    const taskData = {
      tenantId: actor.tenantId,
      checkId: check.id,
      assigneeId: assignee?.id,
      status: assignee ? "OPEN" : "UNASSIGNED",
      dueAt: check.dueAt,
      instructions:
        `Re-verify corrected evidence after clarification: ${target.subject}`.slice(
          0,
          1000,
        ),
    };
    const task = activeTask
      ? await tx.checkTask.update({
          where: { id: previous.id },
          data: {
            ...taskData,
            assigneeId: assignee?.id ?? null,
            startedAt: null,
            completedAt: null,
            blockerReason: null,
            blockedAt: null,
            version: { increment: 1 },
          },
        })
      : await tx.checkTask.create({ data: taskData });
    await tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "clarification.reverification-required",
        resourceType: "task",
        resourcePublicId: task.publicId,
        beforeJson: JSON.stringify({
          result: check.result,
          riskLevel: check.riskLevel,
          sourceSummary: check.sourceSummary,
        }),
        afterJson: JSON.stringify({
          checkId: check.publicId,
          status: task.status,
        }),
      },
    });
    if (assignee)
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: assignee.id,
          type: "CLARIFICATION_REVERIFICATION",
          title: "Corrected evidence needs verification",
          body: target.subject,
          href: "/verifier",
        },
      });
  }
  if (checks.length) await updateCaseRisk(tx, target.caseId);
  return checks.length;
}

import type { Actor } from "../../common/auth/actor";
import { ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import {
  updateAssignedTask,
  type BulkAssignmentCheck,
} from "../../verification/bulk-task-assignment.helpers";
import type { DispatchCase } from "./dispatch.policy";

export type DispatchVerifier = {
  id: bigint;
  publicId: string;
  displayName: string;
  branchId: bigint | null;
  clientId: bigint | null;
};
export type DispatchPlan = {
  check: BulkAssignmentCheck & { version: number };
  verifier: DispatchVerifier;
  task: BulkAssignmentCheck["tasks"][number] | undefined;
};

export async function writeDispatchTasks(
  tx: Prisma.TransactionClient,
  actor: Actor,
  plan: DispatchPlan[],
  instructions?: string,
) {
  const tasks: Prisma.CheckTaskCreateManyInput[] = [];
  const events: Prisma.AuditEventCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  for (const entry of plan) {
    const task = entry.task
      ? await updateAssignedTask(
          tx,
          entry.task,
          entry.verifier.id,
          instructions,
        )
      : { publicId: randomUUID(), version: 1 };
    if (!entry.task)
      tasks.push({
        publicId: task.publicId,
        tenantId: actor.tenantId,
        checkId: entry.check.id,
        assigneeId: entry.verifier.id,
        status: "OPEN",
        instructions,
      });
    events.push({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "task.assigned",
      resourceType: "task",
      resourcePublicId: task.publicId,
      beforeJson: JSON.stringify({
        assigneeId: null,
        status: entry.task?.status ?? null,
      }),
      afterJson: JSON.stringify({
        caseId: entry.check.case.publicId,
        caseNumber: entry.check.case.caseNumber,
        checkId: entry.check.publicId,
        assigneeId: entry.verifier.publicId,
        assigneeName: entry.verifier.displayName,
        status: "OPEN",
        version: task.version,
        bulk: true,
        source: "case-dispatch",
        instructions,
      }),
    });
    notifications.push({
      tenantId: actor.tenantId,
      userId: entry.verifier.id,
      type: "TASK_ASSIGNED",
      title: "Verification check assigned",
      body: `${entry.check.case.caseNumber} has been assigned to you.`,
      href: "/verifier",
    });
  }
  // Four batched writes for new checks, rather than four round trips per check.
  // Existing tasks retain their individual optimistic-lock update above.
  if (tasks.length) await tx.checkTask.createMany({ data: tasks });
  const updated = await tx.caseCheck.updateMany({
    where: {
      tenantId: actor.tenantId,
      OR: plan.map((entry) => ({
        id: entry.check.id,
        version: entry.check.version,
        status: entry.check.status,
      })),
    },
    data: { status: "ASSIGNED", version: { increment: 1 } },
  });
  if (updated.count !== plan.length)
    throw new ConflictException(
      "A check changed before assignment; refresh readiness",
    );
  await tx.auditEvent.createMany({ data: events });
  await tx.notification.createMany({ data: notifications });
}

export async function writeDispatchTransition(
  tx: Prisma.TransactionClient,
  actor: Actor,
  record: DispatchCase,
) {
  if (record.status === "IN_PROGRESS") return;
  const reason =
    "Reviewed evidence and confirmed verifier allocation in Case 360";
  await tx.caseStatusHistory.create({
    data: {
      caseId: record.id,
      fromStatus: record.status,
      toStatus: "IN_PROGRESS",
      changedById: actor.userId,
      reason,
    },
  });
  await tx.auditEvent.create({
    data: {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "case.transitioned",
      resourceType: "case",
      resourcePublicId: record.publicId,
      beforeJson: JSON.stringify({
        status: record.status,
        version: record.version,
      }),
      afterJson: JSON.stringify({
        caseNumber: record.caseNumber,
        status: "IN_PROGRESS",
        version: record.version + 1,
        reason,
      }),
    },
  });
  await tx.outboxEvent.create({
    data: {
      tenantId: actor.tenantId,
      topic: "case.status.changed",
      aggregateType: "case",
      aggregateId: record.publicId,
      payloadJson: JSON.stringify({ from: record.status, to: "IN_PROGRESS" }),
    },
  });
}

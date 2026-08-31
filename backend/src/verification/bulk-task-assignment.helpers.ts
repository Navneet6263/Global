import { BadRequestException, ConflictException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import type {
  BulkAssignmentItemDto,
  BulkAssignTasksDto,
} from "./dto/bulk-assign-tasks.dto";

export const ACTIVE_TASK_STATUSES = [
  "UNASSIGNED",
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
];
export const MOVABLE_TASK_STATUSES = ["UNASSIGNED", "OPEN", "BLOCKED"];

export type BulkAssignmentCheck = {
  id: bigint;
  publicId: string;
  status: string;
  case: {
    publicId: string;
    caseNumber: string;
    branchId: bigint | null;
    clientId: bigint;
    status: string;
  };
  tasks: Array<{
    id: bigint;
    publicId: string;
    status: string;
    version: number;
    assigneeId: bigint | null;
    assignee: { publicId: string; displayName: string } | null;
  }>;
};

export function validateBulkAssignmentInput(input: BulkAssignTasksDto) {
  const malformed = input.items.some(
    (item) => Boolean(item.taskId) !== Boolean(item.version),
  );
  if (malformed) {
    throw new BadRequestException(
      "Task ID and version must be supplied together",
    );
  }
  if (input.mode === "REASSIGN" && input.items.some((item) => !item.taskId)) {
    throw new BadRequestException(
      "Reassignment requires the current task ID and version",
    );
  }
}

export function validateAssignmentCheck(
  check: BulkAssignmentCheck,
  item: BulkAssignmentItemDto,
  input: BulkAssignTasksDto,
  assignee: {
    id: bigint;
    branchId: bigint | null;
    clientId: bigint | null;
  },
) {
  if (check.status === "COMPLETED") {
    throw new ConflictException("A completed check cannot be assigned");
  }
  if (!["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(check.case.status)) {
    throw new ConflictException(
      "Selected checks must belong to cases in active verification",
    );
  }
  if (assignee.branchId && check.case.branchId !== assignee.branchId) {
    throw new ConflictException(
      "Selected verifier is not active in every selected check branch",
    );
  }
  if (assignee.clientId && check.case.clientId !== assignee.clientId) {
    throw new ConflictException(
      "Selected verifier is not scoped to every selected check client",
    );
  }
  if (check.tasks.length > 1) {
    throw new ConflictException("A check has multiple active tasks");
  }
  const task = check.tasks[0];
  if (Boolean(task) !== Boolean(item.taskId)) {
    throw queueChanged();
  }
  if (!task) {
    if (check.status !== "PENDING") throw queueChanged();
    return undefined;
  }
  if (task.publicId !== item.taskId || task.version !== item.version) {
    throw queueChanged();
  }
  if (!MOVABLE_TASK_STATUSES.includes(task.status)) {
    throw new ConflictException(
      "In-progress work must be blocked before reassignment",
    );
  }
  if (input.mode === "ASSIGN" && task.assigneeId) {
    throw new ConflictException("A selected check already has an owner");
  }
  if (input.mode === "REASSIGN" && !task.assigneeId) {
    throw new ConflictException("A selected check no longer has an owner");
  }
  if (task.assigneeId === assignee.id) {
    throw new ConflictException(
      "A selected check is already assigned to this verifier",
    );
  }
  return task;
}

export async function updateAssignedTask(
  tx: Prisma.TransactionClient,
  task: BulkAssignmentCheck["tasks"][number],
  assigneeId: bigint,
  instructions?: string,
) {
  const updated = await tx.checkTask.updateMany({
    where: {
      id: task.id,
      version: task.version,
      status: { in: MOVABLE_TASK_STATUSES },
      assigneeId: task.assigneeId,
    },
    data: {
      assigneeId,
      status: "OPEN",
      ...(instructions ? { instructions } : {}),
      blockerReason: null,
      blockedAt: null,
      startedAt: null,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) throw queueChanged();
  return { publicId: task.publicId, version: task.version + 1 };
}

export async function notifyTaskAssignment(
  tx: Prisma.TransactionClient,
  tenantId: bigint,
  assignee: { id: bigint; displayName: string },
  previous: { publicId: string; displayName: string } | null,
  check: BulkAssignmentCheck,
) {
  await tx.notification.create({
    data: {
      tenantId,
      userId: assignee.id,
      type: previous ? "TASK_REASSIGNED" : "TASK_ASSIGNED",
      title: "Verification check assigned",
      body: `${check.case.caseNumber} has been assigned to you.`,
      href: "/verifier",
    },
  });
  const oldTask = check.tasks[0];
  if (previous && oldTask?.assigneeId) {
    await tx.notification.create({
      data: {
        tenantId,
        userId: oldTask.assigneeId,
        type: "TASK_REASSIGNED_AWAY",
        title: "Verification check reassigned",
        body: `${check.case.caseNumber} is now owned by ${assignee.displayName}.`,
        href: "/verifier",
      },
    });
  }
}

export function isAssignmentWriteConflict(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2034",
  );
}

export function queueChanged() {
  return new ConflictException(
    "Assignment queue changed; refresh before trying again",
  );
}

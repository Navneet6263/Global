import { BadRequestException, ConflictException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { roleIs } from "../common/auth/role-filter";
import type { PrismaService } from "../database/prisma.service";
import type { AssignDataEntryDto } from "./dto/workflow.dto";
import { assertAssignDataEntrySubmissionReady } from "./intake-eligibility.helpers";
import type { IntakeCaseRecord } from "./intake-queue.presenter";
import {
  assertCaseOwner,
  assertStage,
  assertVersion,
  assertWorkflowV2,
  isSupervisor,
  ledDepartmentIds,
  trimNote,
} from "./workflow-access";

export interface ResolvedDataEntryAssignee {
  id: bigint;
  publicId: string;
  displayName: string;
  inActiveDepartment: boolean;
}

export async function validateDataEntryAssignee(
  prisma: PrismaService,
  actor: Actor,
  assigneeId: string,
): Promise<ResolvedDataEntryAssignee> {
  const leads = ledDepartmentIds(actor, "DATA_ENTRY");
  const canSelfAssign =
    assigneeId === actor.userPublicId &&
    actor.roles.includes("SPOC_RM") &&
    actor.roles.includes("DATA_ENTRY");
  const departmentFilter = {
    departmentMemberships: {
      some: {
        department: {
          tenantId: actor.tenantId,
          kind: "DATA_ENTRY",
          status: "ACTIVE",
        },
        ...(leads.length &&
        !isSupervisor(actor) &&
        !actor.roles.includes("SPOC_RM")
          ? { departmentId: { in: leads } }
          : {}),
      },
    },
  };
  const assignee = await prisma.user.findFirst({
    where: {
      tenantId: actor.tenantId,
      publicId: assigneeId,
      status: "ACTIVE",
      userRoles: { some: { role: roleIs("DATA_ENTRY") } },
      ...(canSelfAssign ? {} : departmentFilter),
    },
    select: {
      id: true,
      publicId: true,
      displayName: true,
    },
  });
  if (!assignee) {
    throw new BadRequestException(
      "Choose an active member of the Data Entry team",
    );
  }
  return {
    id: assignee.id,
    publicId: assignee.publicId,
    displayName: assignee.displayName,
    inActiveDepartment: !canSelfAssign,
  };
}

export async function assertCaseAssignableForDataEntry(
  prisma: PrismaService,
  actor: Actor,
  current: IntakeCaseRecord,
  expectedVersion: number,
) {
  assertWorkflowV2(current);
  assertVersion(current.version, expectedVersion);
  const leads = ledDepartmentIds(actor, "DATA_ENTRY");
  if (
    !(
      actor.roles.includes("DATA_ENTRY") &&
      leads.length &&
      current.dataEntryUserId
    )
  ) {
    assertCaseOwner(actor, current.assignedOpsUserId);
  }
  if (!current.assignedOpsUserId) {
    throw new ConflictException("Assign the responsible RM before Data Entry");
  }
  if (current.status !== "DOCUMENT_PENDING") {
    throw new ConflictException(
      "Data Entry starts after the candidate has given consent and submitted documents",
    );
  }
  await assertAssignDataEntrySubmissionReady(prisma, actor.tenantId, current);
  assertStage(
    current,
    ["INTAKE", "DATA_ENTRY", "CORRECTION"],
    "Data Entry has already marked this case Ready",
  );
}

export async function assignCaseToDataEntry(
  prisma: PrismaService,
  actor: Actor,
  current: IntakeCaseRecord,
  assignee: ResolvedDataEntryAssignee,
  expectedVersion: number,
  rawNote?: string,
  skipCaseChecks = false,
) {
  if (!skipCaseChecks) {
    await assertCaseAssignableForDataEntry(
      prisma,
      actor,
      current,
      expectedVersion,
    );
  }
  if (
    !assignee.inActiveDepartment &&
    current.assignedOpsUserId !== actor.userId
  ) {
    const member =
      typeof prisma.departmentMember?.findFirst === "function"
        ? await prisma.departmentMember.findFirst({
            where: {
              userId: assignee.id,
              department: {
                tenantId: actor.tenantId,
                kind: "DATA_ENTRY",
                status: "ACTIVE",
              },
            },
            select: { departmentId: true },
          })
        : null;
    if (!member) {
      throw new BadRequestException(
        "Choose an active member of the Data Entry team",
      );
    }
  }
  if (assignee.id === current.dataEntryUserId) {
    throw new ConflictException(
      "This case is already with this Data Entry user",
    );
  }
  const note = trimNote(rawNote);
  const stage =
    current.intakeStage === "CORRECTION" ? "CORRECTION" : "DATA_ENTRY";
  await prisma.$transaction(async (tx) => {
    const updated = await tx.verificationCase.updateMany({
      where: {
        id: current.id,
        version: expectedVersion,
        status: "DOCUMENT_PENDING",
        intakeStage: { in: ["INTAKE", "DATA_ENTRY", "CORRECTION"] },
      },
      data: {
        dataEntryUserId: assignee.id,
        dataEntryAssignedAt: new Date(),
        intakeStage: stage,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        "Case changed since it was loaded; refresh and try again",
      );
    }
    await tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: current.dataEntryUserId
          ? "case.data-entry-reassigned"
          : "case.data-entry-assigned",
        resourceType: "case",
        resourcePublicId: current.publicId,
        beforeJson: JSON.stringify({
          intakeStage: current.intakeStage,
          version: current.version,
        }),
        afterJson: JSON.stringify({
          caseNumber: current.caseNumber,
          dataEntryUserId: assignee.publicId,
          dataEntryUserName: assignee.displayName,
          intakeStage: stage,
          note,
        }),
      },
    });
    await tx.notification.create({
      data: {
        tenantId: actor.tenantId,
        userId: assignee.id,
        type: "DATA_ENTRY_ASSIGNED",
        title: "Case assigned for Data Entry",
        body: `${current.caseNumber} is ready for completeness review.${note ? ` Note: ${note}` : ""}`,
        href: `/data-entry?caseId=${current.publicId}`,
      },
    });
  });
  return {
    id: current.publicId,
    dataEntry: { id: assignee.publicId, name: assignee.displayName },
    intakeStage: stage,
    version: current.version + 1,
  };
}

export async function executeAssignDataEntry(
  prisma: PrismaService,
  actor: Actor,
  current: IntakeCaseRecord,
  _casePublicId: string,
  input: AssignDataEntryDto,
) {
  await assertCaseAssignableForDataEntry(prisma, actor, current, input.version);
  const assignee = await validateDataEntryAssignee(
    prisma,
    actor,
    input.assigneeId,
  );
  return assignCaseToDataEntry(
    prisma,
    actor,
    current,
    assignee,
    input.version,
    input.note,
    true,
  );
}

import { roleIs } from "../common/auth/role-filter";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { assertCaseEvidenceReady } from "../documents/evidence-readiness";
import type { Prisma } from "../generated/prisma/client";
import type {
  AssignDataEntryDto,
  InitiateCheckDto,
  RmQueueQueryDto,
  SendBackDto,
  VersionedNoteDto,
  WorkQueueQueryDto,
} from "./dto/workflow.dto";
import { INITIATION_FORMS, cleanInitiation } from "./initiation-fields";
import {
  OPEN_CLARIFICATION,
  assertCaseOwner,
  assertStage,
  assertVersion,
  assertWorkflowV2,
  isSupervisor,
  ledDepartmentIds,
  trimNote,
} from "./workflow-access";

const intakeSelect = {
  id: true,
  publicId: true,
  caseNumber: true,
  status: true,
  version: true,
  workflowVersion: true,
  intakeStage: true,
  assignedOpsUserId: true,
  dataEntryUserId: true,
  branchId: true,
  clientId: true,
} satisfies Prisma.VerificationCaseSelect;

/** Fields every work-queue row needs; nothing private to another role. */
export const queueCaseSelect = {
  publicId: true,
  caseNumber: true,
  status: true,
  priority: true,
  version: true,
  workflowVersion: true,
  intakeStage: true,
  dueAt: true,
  createdAt: true,
  updatedAt: true,
  dataEntryAssignedAt: true,
  dataEntryReadyAt: true,
  escalatedAt: true,
  escalationNote: true,
  subject: { select: { fullName: true } },
  client: { select: { publicId: true, displayName: true } },
  assignedOpsUser: { select: { publicId: true, displayName: true } },
  dataEntryUser: { select: { publicId: true, displayName: true } },
  documents: { select: { status: true } },
  clarifications: {
    where: { status: { in: OPEN_CLARIFICATION } },
    select: { level: true, status: true },
  },
  checks: {
    select: {
      status: true,
      department: { select: { publicId: true, name: true } },
      tasks: {
        where: {
          status: { in: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"] },
        },
        select: { status: true, assignee: { select: { displayName: true } } },
      },
    },
  },
} satisfies Prisma.VerificationCaseSelect;

type QueueCase = Prisma.VerificationCaseGetPayload<{
  select: typeof queueCaseSelect;
}>;

export function presentQueueCase(row: QueueCase) {
  const done = row.checks.filter(
    (check) => check.status === "COMPLETED",
  ).length;
  return {
    id: row.publicId,
    caseNumber: row.caseNumber,
    status: row.status,
    priority: row.priority,
    version: row.version,
    workflowVersion: row.workflowVersion,
    intakeStage: row.intakeStage,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    dataEntryAssignedAt: row.dataEntryAssignedAt,
    dataEntryReadyAt: row.dataEntryReadyAt,
    candidateName: row.subject.fullName,
    client: { id: row.client.publicId, name: row.client.displayName },
    // Internal queues only: who escalated is not exposed here, just when and why.
    escalation: row.escalatedAt
      ? { at: row.escalatedAt, note: row.escalationNote }
      : null,
    rm: row.assignedOpsUser
      ? {
          id: row.assignedOpsUser.publicId,
          name: row.assignedOpsUser.displayName,
        }
      : null,
    dataEntry: row.dataEntryUser
      ? { id: row.dataEntryUser.publicId, name: row.dataEntryUser.displayName }
      : null,
    documents: {
      total: row.documents.length,
      rejected: row.documents.filter(
        (document) => document.status === "REJECTED",
      ).length,
    },
    openInsufficiency: {
      l1: row.clarifications.filter((item) => item.level === "L1").length,
      l2: row.clarifications.filter((item) => item.level !== "L1").length,
    },
    checks: {
      total: row.checks.length,
      completed: done,
      unassigned: row.checks.filter((check) =>
        check.tasks.some((task) => task.status === "UNASSIGNED"),
      ).length,
      departments: [
        ...new Set(
          row.checks.flatMap((check) =>
            check.department ? [check.department.name] : [],
          ),
        ),
      ],
    },
  };
}

const CLOSED_STATUSES = ["COMPLETED", "CLOSED", "CANCELLED", "STOPPED"];

export const RM_BUCKETS: Record<string, Prisma.VerificationCaseWhereInput> = {
  needs_data_entry: { intakeStage: "INTAKE", status: "DOCUMENT_PENDING" },
  with_data_entry: { intakeStage: "DATA_ENTRY" },
  correction: { intakeStage: "CORRECTION" },
  ready: { intakeStage: "READY" },
  in_verification: {
    intakeStage: "ROUTED",
    status: { in: ["IN_PROGRESS", "CLARIFICATION_PENDING"] },
  },
  qc: { status: "QA_REVIEW" },
  final_approval: { status: "MANAGER_REVIEW" },
};

@Injectable()
export class IntakeService {
  constructor(private readonly prisma: PrismaService) {}

  /** RM (or its Data Entry lead, or Operations) hands the case to a Data Entry user. */
  async assignDataEntry(
    actor: Actor,
    casePublicId: string,
    input: AssignDataEntryDto,
  ) {
    const current = await this.findCase(actor, casePublicId);
    assertWorkflowV2(current);
    assertVersion(current.version, input.version);
    const leads = ledDepartmentIds(actor, "DATA_ENTRY");
    if (!(
      actor.roles.includes("DATA_ENTRY") &&
      leads.length &&
      current.dataEntryUserId
    ))
      assertCaseOwner(actor, current.assignedOpsUserId);
    if (!current.assignedOpsUserId)
      throw new ConflictException(
        "Assign the responsible RM before Data Entry",
      );
    if (current.status !== "DOCUMENT_PENDING")
      throw new ConflictException(
        "Data Entry starts after the candidate has given consent and submitted documents",
      );
    assertStage(
      current,
      ["INTAKE", "DATA_ENTRY", "CORRECTION"],
      "Data Entry has already marked this case Ready",
    );
    // The case RM who also holds Data Entry may take the data entry itself without
    // being in a Data Entry team (RM-does-data-entry way of working).
    const selfDataEntry =
      input.assigneeId === actor.userPublicId &&
      actor.roles.includes("SPOC_RM") &&
      actor.roles.includes("DATA_ENTRY") &&
      current.assignedOpsUserId === actor.userId;
    const assignee = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.assigneeId,
        status: "ACTIVE",
        userRoles: { some: { role: roleIs("DATA_ENTRY") } },
        ...(selfDataEntry
          ? {}
          : {
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
            }),
      },
      select: { id: true, publicId: true, displayName: true },
    });
    if (!assignee)
      throw new BadRequestException(
        "Choose an active member of the Data Entry team",
      );
    if (assignee.id === current.dataEntryUserId)
      throw new ConflictException(
        "This case is already with this Data Entry user",
      );
    const note = trimNote(input.note);
    const stage =
      current.intakeStage === "CORRECTION" ? "CORRECTION" : "DATA_ENTRY";
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: { id: current.id, version: input.version },
        data: {
          dataEntryUserId: assignee.id,
          dataEntryAssignedAt: new Date(),
          intakeStage: stage,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Case changed since it was loaded; refresh and try again",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: current.dataEntryUserId
            ? "case.data-entry-reassigned"
            : "case.data-entry-assigned",
          resourceType: "case",
          resourcePublicId: casePublicId,
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
          href: `/data-entry?caseId=${casePublicId}`,
        },
      });
    });
    return {
      id: casePublicId,
      dataEntry: { id: assignee.publicId, name: assignee.displayName },
      intakeStage: stage,
      version: current.version + 1,
    };
  }

  /** Check-wise initiation forms, so the screen and the validation never drift apart. */
  initiationForms() {
    return { forms: INITIATION_FORMS };
  }

  /**
   * Data Entry records a check's initiation details (address, employer, institute, court
   * years, ID number...). Audited without the personal values themselves.
   */
  async initiateCheck(
    actor: Actor,
    casePublicId: string,
    checkPublicId: string,
    input: InitiateCheckDto,
  ) {
    const current = await this.findCase(actor, casePublicId);
    assertWorkflowV2(current);
    this.assertDataEntryActor(actor, current);
    assertStage(
      current,
      ["DATA_ENTRY", "CORRECTION"],
      "Checks are initiated while the case is with Data Entry",
    );
    const check = await this.prisma.caseCheck.findFirst({
      where: { caseId: current.id, publicId: checkPublicId },
      select: { id: true, type: true, initiatedAt: true },
    });
    if (!check) throw new NotFoundException("Check not found in this case");
    const entries = cleanInitiation(check.type, input.entries);
    const initiatedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.caseCheck.update({
        where: { id: check.id },
        data: {
          initiationJson: JSON.stringify({ entries }),
          initiatedAt,
          initiatedById: actor.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: check.initiatedAt
            ? "check.initiation-updated"
            : "check.initiated",
          resourceType: "check",
          resourcePublicId: checkPublicId,
          afterJson: JSON.stringify({
            caseNumber: current.caseNumber,
            checkType: check.type,
            entries: entries.length,
            fields: [
              ...new Set(entries.flatMap((entry) => Object.keys(entry))),
            ],
          }),
        },
      });
    });
    return { id: checkPublicId, initiatedAt, entries };
  }

  /** Data Entry confirms completeness; the case returns to the RM, never to Operations. */
  async markReady(actor: Actor, casePublicId: string, input: VersionedNoteDto) {
    const current = await this.findCase(actor, casePublicId);
    assertWorkflowV2(current);
    assertVersion(current.version, input.version);
    this.assertDataEntryActor(actor, current);
    assertStage(
      current,
      ["DATA_ENTRY"],
      current.intakeStage === "CORRECTION"
        ? "Resolve the open correction request before marking Ready"
        : "This case is not with Data Entry",
    );
    const note = trimNote(input.note);
    await this.prisma.$transaction(async (tx) => {
      const [openRequests, rejected] = await Promise.all([
        tx.clarification.count({
          where: { caseId: current.id, status: { in: OPEN_CLARIFICATION } },
        }),
        tx.document.count({
          where: { caseId: current.id, status: "REJECTED" },
        }),
      ]);
      if (openRequests)
        throw new BadRequestException(
          "Resolve every open correction request before marking Ready",
        );
      if (rejected)
        throw new BadRequestException(
          "Rejected documents must be replaced before marking Ready",
        );
      const notInitiated = await tx.caseCheck.findMany({
        where: {
          caseId: current.id,
          initiatedAt: null,
          type: { in: Object.keys(INITIATION_FORMS) },
        },
        select: { type: true },
      });
      if (notInitiated.length)
        throw new BadRequestException(
          `Initiate every check before marking Ready: ${notInitiated
            .map((check) => check.type.replaceAll("_", " ").toLowerCase())
            .join(", ")}`,
        );
      await assertCaseEvidenceReady(tx, current.id, { includeWork: false });
      const updated = await tx.verificationCase.updateMany({
        where: {
          id: current.id,
          version: input.version,
          intakeStage: "DATA_ENTRY",
        },
        data: {
          intakeStage: "READY",
          dataEntryReadyAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Case changed since it was loaded; refresh and try again",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.data-entry-ready",
          resourceType: "case",
          resourcePublicId: casePublicId,
          beforeJson: JSON.stringify({
            intakeStage: "DATA_ENTRY",
            version: current.version,
          }),
          afterJson: JSON.stringify({
            caseNumber: current.caseNumber,
            intakeStage: "READY",
            note,
          }),
        },
      });
      if (current.assignedOpsUserId)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: current.assignedOpsUserId,
            type: "DATA_ENTRY_READY",
            title: "Case ready for routing",
            body: `${current.caseNumber}: Data Entry marked the case Ready. Route its checks to departments.`,
            href: `/spoc-rm/work?caseId=${casePublicId}`,
          },
        });
    });
    return {
      id: casePublicId,
      intakeStage: "READY",
      version: current.version + 1,
    };
  }

  /** RM returns a Ready case to Data Entry with a reason. */
  async sendBack(actor: Actor, casePublicId: string, input: SendBackDto) {
    const current = await this.findCase(actor, casePublicId);
    assertWorkflowV2(current);
    assertVersion(current.version, input.version);
    assertCaseOwner(actor, current.assignedOpsUserId);
    assertStage(
      current,
      ["READY"],
      "Only a Ready case can be sent back to Data Entry",
    );
    const reason = input.reason.trim();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: { id: current.id, version: input.version, intakeStage: "READY" },
        data: {
          intakeStage: "DATA_ENTRY",
          dataEntryReadyAt: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Case changed since it was loaded; refresh and try again",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.data-entry-returned",
          resourceType: "case",
          resourcePublicId: casePublicId,
          beforeJson: JSON.stringify({ intakeStage: "READY" }),
          afterJson: JSON.stringify({
            caseNumber: current.caseNumber,
            intakeStage: "DATA_ENTRY",
            reason,
          }),
        },
      });
      if (current.dataEntryUserId)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: current.dataEntryUserId,
            type: "DATA_ENTRY_RETURNED",
            title: "Case returned by RM",
            body: `${current.caseNumber}: ${reason}`,
            href: `/data-entry?caseId=${casePublicId}`,
          },
        });
    });
    return {
      id: casePublicId,
      intakeStage: "DATA_ENTRY",
      version: current.version + 1,
    };
  }

  /** Data Entry queue: own cases; a Data Entry lead also sees its team and can reassign. */
  async dataEntryQueue(actor: Actor, query: WorkQueueQueryDto) {
    const supervisor = isSupervisor(actor);
    if (!supervisor && !actor.roles.includes("DATA_ENTRY"))
      throw new ForbiddenException(
        "Data Entry queue is for the Data Entry team",
      );
    const leads = ledDepartmentIds(actor, "DATA_ENTRY");
    const view = query.view ?? "mine";
    const scope: Prisma.VerificationCaseWhereInput =
      view === "mine" || (!leads.length && !supervisor)
        ? { dataEntryUserId: actor.userId }
        : supervisor
          ? { dataEntryUserId: { not: null } }
          : {
              dataEntryUser: {
                departmentMemberships: {
                  some: { departmentId: { in: leads } },
                },
              },
            };
    const where: Prisma.VerificationCaseWhereInput = {
      ...caseAccessScope(actor),
      workflowVersion: 2,
      intakeStage: { in: ["DATA_ENTRY", "CORRECTION"] },
      AND: [scope, ...(query.search ? [searchWhere(query.search)] : [])],
    };
    return this.page(
      where,
      query,
      [{ dueAt: "asc" }, { dataEntryAssignedAt: "asc" }, { publicId: "asc" }],
      {
        mine: {
          ...caseAccessScope(actor),
          workflowVersion: 2,
          dataEntryUserId: actor.userId,
          intakeStage: "DATA_ENTRY",
        },
        correction: {
          ...caseAccessScope(actor),
          workflowVersion: 2,
          intakeStage: "CORRECTION",
          ...(view === "mine" || (!leads.length && !supervisor)
            ? { dataEntryUserId: actor.userId }
            : {}),
        },
      },
    );
  }

  /** RM work queue: the RM's own v2 cases in flow order. Operations sees every RM's cases. */
  async rmQueue(actor: Actor, query: RmQueueQueryDto) {
    const supervisor = isSupervisor(actor);
    if (!supervisor && !actor.roles.includes("SPOC_RM"))
      throw new ForbiddenException("RM queue is for responsible RMs");
    const base: Prisma.VerificationCaseWhereInput = {
      ...caseAccessScope(actor),
      workflowVersion: 2,
      ...(supervisor
        ? { assignedOpsUserId: { not: null } }
        : { assignedOpsUserId: actor.userId }),
    };
    const bucket =
      query.bucket && query.bucket !== "all"
        ? RM_BUCKETS[query.bucket]
        : undefined;
    const where: Prisma.VerificationCaseWhereInput = {
      ...base,
      ...(bucket
        ? {}
        : {
            status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED", "STOPPED"] },
          }),
      AND: [
        ...(bucket ? [bucket] : []),
        ...(query.search ? [searchWhere(query.search)] : []),
        ...(query.clientId ? [{ client: { publicId: query.clientId } }] : []),
        ...(query.flag === "escalated"
          ? [{ escalatedAt: { not: null }, status: { notIn: CLOSED_STATUSES } }]
          : query.flag === "overdue"
            ? [
                {
                  dueAt: { lt: new Date() },
                  status: { notIn: CLOSED_STATUSES },
                },
              ]
            : []),
      ],
    };
    const counts = Object.fromEntries(
      Object.entries(RM_BUCKETS).map(([key, value]) => [
        key,
        { ...base, ...value },
      ]),
    );
    const [result, summary] = await Promise.all([
      this.page(
        where,
        query,
        query.sort === "newest"
          ? [{ createdAt: "desc" }, { publicId: "asc" }]
          : [{ dueAt: "asc" }, { updatedAt: "asc" }, { publicId: "asc" }],
        counts,
      ),
      this.rmSummary(base),
    ]);
    return { ...result, summary };
  }

  /**
   * Headline numbers for the RM overview: active work, what is due today or overdue,
   * what finished this week, and a per-company pulse. Same scope as the queue.
   */
  private async rmSummary(base: Prisma.VerificationCaseWhereInput) {
    const now = new Date();
    // End of today in India time (UTC+05:30).
    const ist = new Date(now.getTime() + 330 * 60_000);
    const endOfDay = new Date(
      Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1) -
        330 * 60_000,
    );
    const active: Prisma.VerificationCaseWhereInput = {
      ...base,
      status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED", "STOPPED"] },
    };
    const overdueWhere = { ...active, dueAt: { lt: now } };
    const [
      activeCount,
      overdue,
      dueToday,
      completedThisWeek,
      byClient,
      overdueByClient,
      escalated,
    ] = await Promise.all([
      this.prisma.verificationCase.count({ where: active }),
      this.prisma.verificationCase.count({ where: overdueWhere }),
      this.prisma.verificationCase.count({
        where: { ...active, dueAt: { gte: now, lt: endOfDay } },
      }),
      this.prisma.verificationCase.count({
        where: {
          ...base,
          status: { in: ["COMPLETED", "CLOSED"] },
          updatedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        },
      }),
      this.prisma.verificationCase.groupBy({
        by: ["clientId"],
        where: active,
        _count: { _all: true },
      }),
      this.prisma.verificationCase.groupBy({
        by: ["clientId"],
        where: overdueWhere,
        _count: { _all: true },
      }),
      this.prisma.verificationCase.count({
        where: { ...active, escalatedAt: { not: null } },
      }),
    ]);
    const top = [...byClient]
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 6);
    const names = top.length
      ? await this.prisma.client.findMany({
          where: { id: { in: top.map((row) => row.clientId) } },
          select: { id: true, publicId: true, displayName: true },
        })
      : [];
    return {
      active: activeCount,
      overdue,
      dueToday,
      completedThisWeek,
      escalated,
      clients: top.flatMap((row) => {
        const client = names.find((item) => item.id === row.clientId);
        if (!client) return [];
        return [
          {
            id: client.publicId,
            name: client.displayName,
            active: row._count._all,
            overdue:
              overdueByClient.find((item) => item.clientId === row.clientId)
                ?._count._all ?? 0,
          },
        ];
      }),
    };
  }

  private async page(
    where: Prisma.VerificationCaseWhereInput,
    query: { page?: number; pageSize?: number },
    orderBy: Prisma.VerificationCaseOrderByWithRelationInput[],
    countWheres: Record<string, Prisma.VerificationCaseWhereInput>,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keys = Object.keys(countWheres);
    const [rows, total, ...counts] = await Promise.all([
      this.prisma.verificationCase.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: queueCaseSelect,
      }),
      this.prisma.verificationCase.count({ where }),
      ...keys.map((key) =>
        this.prisma.verificationCase.count({ where: countWheres[key]! }),
      ),
    ]);
    return {
      items: rows.map(presentQueueCase),
      total,
      page,
      pageSize,
      counts: Object.fromEntries(
        keys.map((key, index) => [key, counts[index]!]),
      ),
      generatedAt: new Date(),
    };
  }

  private assertDataEntryActor(
    actor: Actor,
    current: { dataEntryUserId: bigint | null },
  ) {
    if (isSupervisor(actor)) return;
    if (!actor.roles.includes("DATA_ENTRY"))
      throw new ForbiddenException("Only Data Entry can mark a case Ready");
    if (current.dataEntryUserId === actor.userId) return;
    if (ledDepartmentIds(actor, "DATA_ENTRY").length) return; // scope already limits to the lead's team
    throw new ForbiddenException(
      "This case is assigned to another Data Entry user",
    );
  }

  private async findCase(actor: Actor, publicId: string) {
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId },
      select: intakeSelect,
    });
    if (!row) throw new NotFoundException("Case not found");
    return row;
  }
}

export function searchWhere(search: string): Prisma.VerificationCaseWhereInput {
  const term = search.trim().slice(0, 120);
  return {
    OR: [
      { caseNumber: { contains: term } },
      { externalRef: { contains: term } },
      { subject: { fullName: { contains: term } } },
      { client: { displayName: { contains: term } } },
    ],
  };
}

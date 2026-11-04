import { roleIs } from "../common/auth/role-filter";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { CaseWorkflowPolicy } from "../cases/case-workflow.policy";
import type { Prisma } from "../generated/prisma/client";
import { parseCheckTypes } from "./departments.service";
import type {
  AssignTaskDto,
  RouteChecksDto,
  WorkQueueQueryDto,
} from "./dto/workflow.dto";
import {
  ACTIVE_TASK,
  REASSIGNABLE_TASK,
  assertCaseOwner,
  assertStage,
  assertVersion,
  assertWorkflowV2,
  isSupervisor,
  ledDepartmentIds,
  trimNote,
} from "./workflow-access";

const ROUTING_CASE = {
  id: true,
  publicId: true,
  caseNumber: true,
  status: true,
  version: true,
  workflowVersion: true,
  intakeStage: true,
  assignedOpsUserId: true,
  checks: {
    select: {
      id: true,
      publicId: true,
      type: true,
      status: true,
      tasks: {
        where: { status: { in: ACTIVE_TASK } },
        select: { id: true },
      },
    },
  },
} satisfies Prisma.VerificationCaseSelect;

/** Checks each kind of verification team works when the team lists none of its own. */
export const TEAM_TYPE_CHECKS: Readonly<Record<string, readonly string[]>> = {
  EMPLOYMENT: ["EMPLOYMENT", "UAN_CHECK", "REFERENCE"],
  EDUCATION: ["EDUCATION"],
  DIGITAL: [
    "IDENTITY",
    "PAN_VALIDATION",
    "DIGITAL_ADDRESS",
    "GLOBAL_DATABASE",
    "INDIA_DATABASE",
    "SOCIAL_MEDIA",
    "ADVERSE_MEDIA",
    "SANCTIONS",
    "DIRECTORSHIP",
    "CREDIT_CHECK",
    "BANK_ACCOUNT",
    "RESUME_CONSISTENCY",
    "CONFLICT_OF_INTEREST",
    "ANTI_BRIBERY",
    "MISCONDUCT",
    "BUSINESS_INTEREST",
    "COMPANY_REGISTRATION",
    "GST_VALIDATION",
    "MCA_VALIDATION",
  ],
  VENDOR: [
    "ADDRESS",
    "CORPORATE_ADDRESS",
    "CRIMINAL",
    "COURT_RECORD",
    "DRUG_TEST",
  ],
};

type RoutableDepartment = {
  publicId: string;
  checkTypesJson: string;
  teamType?: string | null;
  members: ReadonlyArray<{ role: string }>;
};

/** A team's own check list wins; without one it takes its team type's checks. */
export function departmentTakes(department: RoutableDepartment, type: string) {
  const own = parseCheckTypes(department.checkTypesJson);
  return own.length
    ? own.includes(type)
    : (TEAM_TYPE_CHECKS[department.teamType ?? ""] ?? []).includes(type);
}

/**
 * Each check goes to a department that takes its type and has a Team Leader: one that
 * lists the type itself first, then one whose team type covers it.
 */
export function departmentsForChecks(
  checks: ReadonlyArray<{ publicId: string; type: string }>,
  departments: ReadonlyArray<RoutableDepartment>,
) {
  const requested = new Map<string, string>();
  const missing: string[] = [];
  const led = departments.filter((item) =>
    item.members.some((member) => member.role === "LEAD"),
  );
  for (const check of checks) {
    const department =
      led.find((item) =>
        parseCheckTypes(item.checkTypesJson).includes(check.type),
      ) ?? led.find((item) => departmentTakes(item, check.type));
    if (department) requested.set(check.publicId, department.publicId);
    else if (!missing.includes(check.type)) missing.push(check.type);
  }
  return { requested, missing };
}

@Injectable()
export class RoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: CaseWorkflowPolicy,
  ) {}

  /** Checks of a Ready case with the suggested department for each. */
  async plan(actor: Actor, casePublicId: string) {
    const record = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: {
        publicId: true,
        caseNumber: true,
        version: true,
        status: true,
        workflowVersion: true,
        intakeStage: true,
        assignedOpsUserId: true,
        checks: {
          orderBy: { type: "asc" },
          select: {
            publicId: true,
            type: true,
            status: true,
            department: { select: { publicId: true, name: true } },
          },
        },
      },
    });
    if (!record) throw new NotFoundException("Case not found");
    const departments = await this.verificationDepartments(actor);
    return {
      id: record.publicId,
      caseNumber: record.caseNumber,
      version: record.version,
      status: record.status,
      intakeStage: record.intakeStage,
      canRoute:
        record.workflowVersion === 2 &&
        record.intakeStage === "READY" &&
        (isSupervisor(actor) || record.assignedOpsUserId === actor.userId),
      departments: departments.map((department) => ({
        id: department.publicId,
        name: department.name,
        checkTypes: parseCheckTypes(department.checkTypesJson),
        leads: department.members
          .filter((member) => member.role === "LEAD")
          .map((member) => member.user.displayName),
        members: department.members.length,
      })),
      checks: record.checks.map((check) => ({
        id: check.publicId,
        type: check.type,
        status: check.status,
        department: check.department
          ? { id: check.department.publicId, name: check.department.name }
          : null,
        suggestedDepartmentId:
          departmentsForChecks([check], departments).requested.get(
            check.publicId,
          ) ??
          departments.find((department) =>
            departmentTakes(department, check.type),
          )?.publicId ??
          null,
      })),
    };
  }

  /** RM routes every open check to a verification department; verification starts. */
  async route(actor: Actor, casePublicId: string, input: RouteChecksDto) {
    const current = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: {
        id: true,
        publicId: true,
        caseNumber: true,
        status: true,
        version: true,
        workflowVersion: true,
        intakeStage: true,
        assignedOpsUserId: true,
        checks: {
          select: {
            id: true,
            publicId: true,
            type: true,
            status: true,
            tasks: {
              where: { status: { in: ACTIVE_TASK } },
              select: { id: true },
            },
          },
        },
      },
    });
    if (!current) throw new NotFoundException("Case not found");
    assertWorkflowV2(current);
    assertVersion(current.version, input.version);
    assertCaseOwner(actor, current.assignedOpsUserId);
    assertStage(
      current,
      ["READY"],
      "Data Entry must mark the case Ready before routing",
    );
    if (current.status !== "DOCUMENT_PENDING")
      throw new ConflictException(
        "Only a case waiting to start verification can be routed",
      );

    const open = current.checks.filter((check) => check.status !== "COMPLETED");
    const requested = new Map(
      input.routes.map((route) => [route.checkId, route.departmentId]),
    );
    if (requested.size !== input.routes.length)
      throw new BadRequestException("Each check can be routed only once");
    const missing = open.filter((check) => !requested.has(check.publicId));
    if (missing.length)
      throw new BadRequestException(
        `Route every open check: ${missing.map((check) => check.type.replaceAll("_", " ").toLowerCase()).join(", ")}`,
      );
    const unknown = [...requested.keys()].filter(
      (checkId) => !open.some((check) => check.publicId === checkId),
    );
    if (unknown.length)
      throw new BadRequestException(
        "A routed check does not belong to this case",
      );

    const departments = await this.verificationDepartments(actor);
    const byId = new Map(
      departments.map((department) => [department.publicId, department]),
    );
    for (const departmentId of new Set(requested.values())) {
      const department = byId.get(departmentId);
      if (!department)
        throw new BadRequestException(
          "Choose an active verification department",
        );
      if (!department.members.some((member) => member.role === "LEAD"))
        throw new ConflictException(
          `${department.name} has no Team Leader to receive the work`,
        );
    }
    return this.applyRouting(actor, current, open, requested, byId, {
      version: input.version,
      note: trimNote(input.note),
      reason: "RM routed checks to verification departments",
    });
  }

  /**
   * After Data Entry: send every open check to its department without waiting for the
   * RM. Whatever stops this (no department or Team Leader for a check, or an evidence or
   * consent gate) leaves the case Ready for the RM, with the reason.
   */
  async autoRoute(
    actor: Actor,
    casePublicId: string,
  ): Promise<
    | { routed: true; status: string; intakeStage: string; version: number }
    | { routed: false; reason: string }
  > {
    const current = await this.prisma.verificationCase.findFirst({
      where: { tenantId: actor.tenantId, publicId: casePublicId },
      select: ROUTING_CASE,
    });
    if (
      !current ||
      current.intakeStage !== "READY" ||
      current.status !== "DOCUMENT_PENDING"
    )
      return { routed: false, reason: "The case is not waiting to be routed" };
    const open = current.checks.filter((check) => check.status !== "COMPLETED");
    const departments = await this.verificationDepartments(actor);
    const plan = departmentsForChecks(open, departments);
    if (plan.missing.length)
      return {
        routed: false,
        reason: `No department with a Team Leader for: ${plan.missing
          .map((type) => type.replaceAll("_", " ").toLowerCase())
          .join(", ")}`,
      };
    try {
      const result = await this.applyRouting(
        actor,
        current,
        open,
        plan.requested,
        new Map(departments.map((item) => [item.publicId, item])),
        {
          version: current.version,
          note: null,
          reason: "Sent to verification departments after Data Entry",
          automatic: true,
        },
      );
      return { routed: true, ...result };
    } catch (error) {
      if (error instanceof HttpException)
        return { routed: false, reason: error.message };
      throw error;
    }
  }

  private async applyRouting(
    actor: Actor,
    current: Prisma.VerificationCaseGetPayload<{ select: typeof ROUTING_CASE }>,
    open: Prisma.VerificationCaseGetPayload<{
      select: typeof ROUTING_CASE;
    }>["checks"],
    requested: ReadonlyMap<string, string>,
    byId: ReadonlyMap<
      string,
      Awaited<ReturnType<RoutingService["verificationDepartments"]>>[number]
    >,
    input: {
      version: number;
      note: string | null | undefined;
      reason: string;
      automatic?: boolean;
    },
  ) {
    const casePublicId = current.publicId;
    const note = input.note;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const marked = await tx.verificationCase.updateMany({
        where: {
          id: current.id,
          version: input.version,
          intakeStage: "READY",
          status: "DOCUMENT_PENDING",
        },
        data: { intakeStage: "ROUTED" },
      });
      if (marked.count !== 1)
        throw new ConflictException(
          "Case changed since it was loaded; refresh and try again",
        );
      // Same evidence and consent gates as every other start of verification.
      await this.policy.assertAllowed(
        current.id,
        "DOCUMENT_PENDING",
        "IN_PROGRESS",
        tx,
      );
      await tx.verificationCase.update({
        where: { id: current.id },
        data: { status: "IN_PROGRESS", version: { increment: 1 } },
      });
      await tx.caseStatusHistory.create({
        data: {
          caseId: current.id,
          fromStatus: "DOCUMENT_PENDING",
          toStatus: "IN_PROGRESS",
          changedById: actor.userId,
          reason: input.reason,
        },
      });
      for (const check of open) {
        const department = byId.get(requested.get(check.publicId)!)!;
        await tx.caseCheck.update({
          where: { id: check.id },
          data: {
            departmentId: department.id,
            routedAt: now,
            status: "PENDING",
          },
        });
        if (!check.tasks.length)
          await tx.checkTask.create({
            data: {
              tenantId: actor.tenantId,
              checkId: check.id,
              status: "UNASSIGNED",
            },
          });
      }
      const summary = open.map((check) => ({
        checkId: check.publicId,
        type: check.type,
        department: byId.get(requested.get(check.publicId)!)!.name,
      }));
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.checks-routed",
          resourceType: "case",
          resourcePublicId: casePublicId,
          beforeJson: JSON.stringify({
            status: "DOCUMENT_PENDING",
            intakeStage: "READY",
            version: current.version,
          }),
          afterJson: JSON.stringify({
            caseNumber: current.caseNumber,
            status: "IN_PROGRESS",
            intakeStage: "ROUTED",
            routes: summary,
            note,
            ...(input.automatic ? { automatic: true } : {}),
          }),
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: actor.tenantId,
          topic: "case.status.changed",
          aggregateType: "case",
          aggregateId: casePublicId,
          payloadJson: JSON.stringify({
            from: "DOCUMENT_PENDING",
            to: "IN_PROGRESS",
          }),
        },
      });
      const leadIds = new Set<bigint>();
      for (const departmentId of new Set(requested.values()))
        for (const member of byId.get(departmentId)!.members)
          if (member.role === "LEAD") leadIds.add(member.user.id);
      if (leadIds.size)
        await tx.notification.createMany({
          data: [...leadIds].map((userId) => ({
            tenantId: actor.tenantId,
            userId,
            type: "CHECKS_ROUTED",
            title: "New checks for your team",
            body: `${current.caseNumber}: checks routed to your department. Assign a team member.`,
            href: "/verifier/team",
          })),
        });
    });
    return {
      id: casePublicId,
      status: "IN_PROGRESS",
      intakeStage: "ROUTED",
      version: current.version + 1,
    };
  }

  /** Team Leader queue: every active task in the departments the user leads. */
  async teamQueue(actor: Actor, query: WorkQueueQueryDto) {
    const supervisor = isSupervisor(actor);
    const leads = ledDepartmentIds(actor, "VERIFICATION");
    if (!supervisor && !leads.length)
      throw new ForbiddenException("Team queue is for department Team Leaders");
    const department = query.departmentId
      ? await this.prisma.department.findFirst({
          where: { tenantId: actor.tenantId, publicId: query.departmentId },
          select: { id: true },
        })
      : null;
    if (
      query.departmentId &&
      (!department || (!supervisor && !leads.includes(department.id)))
    )
      throw new ForbiddenException("You do not lead this department");
    const departmentIds = department
      ? [department.id]
      : supervisor
        ? undefined
        : leads;
    const view = query.view ?? "all";
    const review = view === "review";
    const where: Prisma.CheckTaskWhereInput = {
      tenantId: actor.tenantId,
      // "review": finished work waiting for the Team Leader before QA.
      status: review ? "COMPLETED" : { in: ACTIVE_TASK },
      check: {
        departmentId: departmentIds ? { in: departmentIds } : { not: null },
        ...(review ? { status: "TL_REVIEW" } : {}),
        ...(query.search
          ? {
              case: {
                OR: [
                  { caseNumber: { contains: query.search.trim() } },
                  { subject: { fullName: { contains: query.search.trim() } } },
                  {
                    client: { displayName: { contains: query.search.trim() } },
                  },
                ],
              },
            }
          : {}),
      },
      ...(view === "unassigned"
        ? { assigneeId: null }
        : view === "mine"
          ? { assigneeId: actor.userId }
          : view === "team"
            ? { assigneeId: { not: null } }
            : {}),
    };
    const base = {
      tenantId: actor.tenantId,
      status: { in: ACTIVE_TASK },
      check: {
        departmentId: departmentIds ? { in: departmentIds } : { not: null },
      },
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const [rows, total, unassigned, blocked, overdue, toReview] =
      await Promise.all([
        this.prisma.checkTask.findMany({
          where,
          orderBy: [
            { assigneeId: "asc" },
            { dueAt: "asc" },
            { createdAt: "asc" },
          ],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            publicId: true,
            status: true,
            version: true,
            dueAt: true,
            createdAt: true,
            completedAt: true,
            blockerReason: true,
            assignee: { select: { publicId: true, displayName: true } },
            check: {
              select: {
                publicId: true,
                type: true,
                status: true,
                result: true,
                disposition: true,
                sourceSummary: true,
                riskLevel: true,
                findings: {
                  select: { title: true, severity: true, kind: true },
                },
                routedAt: true,
                dueAt: true,
                department: { select: { publicId: true, name: true } },
                case: {
                  select: {
                    publicId: true,
                    caseNumber: true,
                    status: true,
                    priority: true,
                    dueAt: true,
                    subject: { select: { fullName: true } },
                    client: { select: { displayName: true } },
                    assignedOpsUser: { select: { displayName: true } },
                  },
                },
              },
            },
          },
        }),
        this.prisma.checkTask.count({ where }),
        this.prisma.checkTask.count({ where: { ...base, assigneeId: null } }),
        this.prisma.checkTask.count({ where: { ...base, status: "BLOCKED" } }),
        this.prisma.checkTask.count({
          where: {
            ...base,
            check: { ...base.check, case: { dueAt: { lt: new Date() } } },
          },
        }),
        this.prisma.checkTask.count({
          where: {
            tenantId: actor.tenantId,
            status: "COMPLETED",
            check: { ...base.check, status: "TL_REVIEW" },
          },
        }),
      ]);
    const members = await this.prisma.departmentMember.findMany({
      where: {
        departmentId: departmentIds ? { in: departmentIds } : undefined,
        department: { tenantId: actor.tenantId, kind: "VERIFICATION" },
        user: { status: "ACTIVE" },
      },
      select: {
        role: true,
        department: { select: { publicId: true, name: true } },
        user: { select: { id: true, publicId: true, displayName: true } },
      },
      orderBy: { user: { displayName: "asc" } },
    });
    const loads = members.length
      ? await this.prisma.checkTask.groupBy({
          by: ["assigneeId"],
          where: {
            tenantId: actor.tenantId,
            status: { in: ACTIVE_TASK },
            assigneeId: { in: members.map((m) => m.user.id) },
          },
          _count: { _all: true },
        })
      : [];
    const load = new Map(loads.map((row) => [row.assigneeId, row._count._all]));
    return {
      items: rows.map((task) => ({
        id: task.publicId,
        status: task.status,
        version: task.version,
        blockerReason: task.blockerReason,
        createdAt: task.createdAt,
        review:
          task.check.status === "TL_REVIEW"
            ? {
                result: task.check.result,
                disposition: task.check.disposition,
                sourceSummary: task.check.sourceSummary,
                riskLevel: task.check.riskLevel,
                findings: task.check.findings,
                completedAt: task.completedAt,
              }
            : null,
        dueAt: task.dueAt ?? task.check.dueAt ?? task.check.case.dueAt,
        assignee: task.assignee
          ? { id: task.assignee.publicId, name: task.assignee.displayName }
          : null,
        check: {
          id: task.check.publicId,
          type: task.check.type,
          status: task.check.status,
          routedAt: task.check.routedAt,
          department: task.check.department
            ? {
                id: task.check.department.publicId,
                name: task.check.department.name,
              }
            : null,
        },
        case: {
          id: task.check.case.publicId,
          caseNumber: task.check.case.caseNumber,
          status: task.check.case.status,
          priority: task.check.case.priority,
          candidateName: task.check.case.subject.fullName,
          clientName: task.check.case.client.displayName,
          rmName: task.check.case.assignedOpsUser?.displayName ?? null,
        },
      })),
      total,
      page,
      pageSize,
      counts: {
        unassigned,
        blocked,
        overdue,
        review: toReview,
        total: await this.prisma.checkTask.count({ where: base }),
      },
      members: members.map((member) => ({
        id: member.user.publicId,
        name: member.user.displayName,
        role: member.role,
        department: {
          id: member.department.publicId,
          name: member.department.name,
        },
        openWork: load.get(member.user.id) ?? 0,
      })),
      generatedAt: new Date(),
    };
  }

  /** Team Leader assigns or reassigns a routed check to a member of its department. */
  async assignTask(actor: Actor, taskPublicId: string, input: AssignTaskDto) {
    const task = await this.prisma.checkTask.findFirst({
      where: { tenantId: actor.tenantId, publicId: taskPublicId },
      select: {
        id: true,
        status: true,
        version: true,
        assigneeId: true,
        assignee: { select: { publicId: true } },
        check: {
          select: {
            id: true,
            type: true,
            departmentId: true,
            department: { select: { name: true } },
            case: {
              select: {
                id: true,
                publicId: true,
                caseNumber: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!task || !task.check.departmentId)
      throw new NotFoundException("Routed check not found");
    const departmentId = task.check.departmentId;
    if (
      !isSupervisor(actor) &&
      !ledDepartmentIds(actor, "VERIFICATION").includes(departmentId)
    )
      throw new ForbiddenException(
        "Only the department's Team Leader can assign this check",
      );
    if (task.version !== input.version)
      throw new ConflictException(
        "Task changed since it was loaded; refresh and try again",
      );
    if (!REASSIGNABLE_TASK.includes(task.status))
      throw new ConflictException(
        "Work already in progress can be moved only after the verifier marks it blocked",
      );
    if (
      !["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(task.check.case.status)
    )
      throw new ConflictException(
        "Checks can be assigned only while the case is in verification",
      );
    const assignee = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.assigneeId,
        status: "ACTIVE",
        userRoles: { some: { role: roleIs("VERIFIER") } },
        departmentMemberships: { some: { departmentId } },
      },
      select: { id: true, publicId: true, displayName: true },
    });
    if (!assignee)
      throw new BadRequestException(
        "Choose an active member of this department",
      );
    if (assignee.id === task.assigneeId)
      throw new ConflictException(
        "This check is already assigned to this member",
      );
    const note = trimNote(input.note);
    // A Team Leader may pick a check to verify personally; it lands in their own queue.
    const selfPick = assignee.id === actor.userId;
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.checkTask.updateMany({
        where: {
          id: task.id,
          version: input.version,
          status: { in: REASSIGNABLE_TASK },
        },
        data: {
          assigneeId: assignee.id,
          status: "OPEN",
          blockerReason: null,
          blockedAt: null,
          ...(note ? { instructions: note } : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Task changed since it was loaded; refresh and try again",
        );
      await tx.caseCheck.update({
        where: { id: task.check.id },
        data: { status: "ASSIGNED" },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: selfPick
            ? "task.taken-by-lead"
            : task.assigneeId
              ? "task.reassigned-by-lead"
              : "task.assigned-by-lead",
          resourceType: "task",
          resourcePublicId: taskPublicId,
          beforeJson: JSON.stringify({
            assigneeId: task.assignee?.publicId ?? null,
            status: task.status,
          }),
          afterJson: JSON.stringify({
            caseNumber: task.check.case.caseNumber,
            check: task.check.type,
            department: task.check.department?.name,
            assigneeId: assignee.publicId,
            assigneeName: assignee.displayName,
            note,
          }),
        },
      });
      if (!selfPick)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: assignee.id,
            type: "TASK_ASSIGNED",
            title: "Verification check assigned",
            body: `${task.check.case.caseNumber}: ${task.check.type.replaceAll("_", " ").toLowerCase()} check assigned to you.`,
            href: "/verifier",
          },
        });
    });
    return {
      id: taskPublicId,
      assignee: { id: assignee.publicId, name: assignee.displayName },
      status: "OPEN",
      version: task.version + 1,
      selfPick,
    };
  }

  private verificationDepartments(actor: Actor) {
    return this.prisma.department.findMany({
      where: {
        tenantId: actor.tenantId,
        kind: "VERIFICATION",
        status: "ACTIVE",
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        publicId: true,
        name: true,
        checkTypesJson: true,
        teamType: true,
        members: {
          where: { user: { status: "ACTIVE" } },
          select: {
            role: true,
            user: { select: { id: true, displayName: true } },
          },
        },
      },
    });
  }
}

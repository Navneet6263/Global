import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { hasAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { updateCaseRisk } from "../verification/case-risk";
import { restartCheckMethods } from "../verification/restart-check-methods";
import {
  resolveVerificationDepartmentId,
  verificationLedDepartmentIds,
} from "../verification/task-query.helpers";
import {
  ACTIVE_REWORK_CASE_STATUSES,
  buildAnnexureCsvFile,
  fetchAnnexureRows,
  type AnnexurePeriod,
  UTV_ROW_SELECT,
} from "./check-annexure.helpers";

export { periodStart, type AnnexurePeriod } from "./check-annexure.helpers";
export type ReworkMode = "REOPEN" | "REINITIATE" | "REJECT";

/** QA and later stages have their own return paths; rework is for live verification. */
const MODE_TEXT: Record<ReworkMode, { audit: string; task: string }> = {
  REOPEN: { audit: "check.utv-reopened", task: "Re-opened from UTV" },
  REINITIATE: {
    audit: "check.utv-reinitiated",
    task: "Re-initiated from UTV",
  },
  REJECT: { audit: "check.rejected-by-lead", task: "Sent back by Team Leader" },
};

/**
 * UTV bucket and Team Leader rework (BGV process): checks closed as Unable To Verify
 * are listed with their reason and can be re-opened (same verifier) or re-initiated
 * (back to allocation); a Team Leader can send a finished check back. Team Leaders
 * also export a weekly / monthly / yearly annexure of their team's closed checks.
 */
@Injectable()
export class CheckReworkService {
  constructor(private readonly prisma: PrismaService) {}

  private canAct(actor: Actor) {
    return (
      hasAnyRole(actor, OPERATIONS_ROLES) ||
      verificationLedDepartmentIds(actor).length > 0
    );
  }

  private async departmentFilter(actor: Actor, departmentId?: string) {
    const resolved = await resolveVerificationDepartmentId(
      this.prisma,
      actor,
      departmentId,
    );
    if (resolved !== undefined) return resolved;
    if (hasAnyRole(actor, OPERATIONS_ROLES)) return undefined;
    const led = verificationLedDepartmentIds(actor);
    return led.length ? { in: led } : undefined;
  }

  async utvBucket(
    actor: Actor,
    query: {
      page: number;
      pageSize: number;
      search?: string;
      departmentId?: string;
    },
  ) {
    const search = query.search?.trim();
    const departmentFilter = await this.departmentFilter(
      actor,
      query.departmentId,
    );
    const where: Prisma.CaseCheckWhereInput = {
      tenantId: actor.tenantId,
      result: "UNABLE_TO_VERIFY",
      ...(departmentFilter !== undefined
        ? { departmentId: departmentFilter }
        : {}),
      case: {
        ...caseAccessScope(actor),
        ...(search
          ? {
              OR: [
                { caseNumber: { contains: search } },
                { subject: { fullName: { contains: search } } },
              ],
            }
          : {}),
      },
    };
    const [total, rows] = await Promise.all([
      this.prisma.caseCheck.count({ where }),
      this.prisma.caseCheck.findMany({
        where,
        orderBy: [{ completedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: UTV_ROW_SELECT,
      }),
    ]);
    const canAct = this.canAct(actor);
    return {
      items: rows.map((row) => ({
        checkId: row.publicId,
        checkType: row.type,
        reason: row.sourceSummary ?? "No reason recorded",
        closedAt: row.completedAt,
        verifier: row.tasks[0]?.assignee?.displayName ?? null,
        caseId: row.case.publicId,
        caseNumber: row.case.caseNumber,
        caseStatus: row.case.status,
        candidateName: row.case.subject.fullName,
        clientName: row.case.client.displayName,
        canRework:
          canAct && ACTIVE_REWORK_CASE_STATUSES.includes(row.case.status),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async rework(
    actor: Actor,
    checkId: string,
    mode: ReworkMode,
    reason: string,
  ) {
    if (!this.canAct(actor))
      throw new ForbiddenException(
        "Only Operations or a Team Leader can send a check back",
      );
    const manager = hasAnyRole(actor, OPERATIONS_ROLES);
    const led = verificationLedDepartmentIds(actor);
    const note = reason.trim();
    return this.prisma.$transaction(async (tx) => {
      const check = await tx.caseCheck.findFirst({
        where: {
          publicId: checkId,
          tenantId: actor.tenantId,
          case: caseAccessScope(actor),
          ...(!manager && led.length ? { departmentId: { in: led } } : {}),
        },
        select: {
          id: true,
          type: true,
          status: true,
          result: true,
          dueAt: true,
          caseId: true,
          case: { select: { publicId: true, caseNumber: true, status: true } },
          tasks: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, assigneeId: true, status: true },
          },
        },
      });
      if (!check) throw new NotFoundException("Check not found");
      if (!ACTIVE_REWORK_CASE_STATUSES.includes(check.case.status))
        throw new ConflictException(
          "The case is closed. Re-open the case from its page first.",
        );
      if (mode !== "REJECT" && check.result !== "UNABLE_TO_VERIFY")
        throw new ConflictException("Only UTV checks are in the UTV bucket");
      if (mode === "REJECT" && check.status !== "COMPLETED")
        throw new ConflictException("Only a finished check can be sent back");
      const previous = check.tasks[0];
      const assigneeId =
        mode === "REINITIATE" ? null : (previous?.assigneeId ?? null);
      await tx.caseCheck.update({
        where: { id: check.id },
        data: {
          status: assigneeId ? "ASSIGNED" : "PENDING",
          result: null,
          disposition: null,
          riskLevel: null,
          sourceSummary: null,
          completedAt: null,
          version: { increment: 1 },
        },
      });
      await restartCheckMethods(tx, check.id, actor.userId);
      const taskData = {
        assigneeId,
        status: assigneeId ? "OPEN" : "UNASSIGNED",
        dueAt: check.dueAt,
        instructions: `${MODE_TEXT[mode].task}: ${note}`.slice(0, 1000),
      };
      // An unfinished task is reused (task statuses have no "cancelled").
      const task =
        previous &&
        ["OPEN", "UNASSIGNED", "IN_PROGRESS", "BLOCKED"].includes(
          previous.status,
        )
          ? await tx.checkTask.update({
              where: { id: previous.id },
              data: {
                ...taskData,
                startedAt: null,
                completedAt: null,
                blockerReason: null,
                blockedAt: null,
                version: { increment: 1 },
              },
              select: { publicId: true },
            })
          : await tx.checkTask.create({
              data: {
                ...taskData,
                tenantId: actor.tenantId,
                checkId: check.id,
              },
              select: { publicId: true },
            });
      await updateCaseRisk(tx, check.caseId);
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: MODE_TEXT[mode].audit,
          resourceType: "case",
          resourcePublicId: check.case.publicId,
          beforeJson: JSON.stringify({
            checkId,
            status: check.status,
            result: check.result,
          }),
          afterJson: JSON.stringify({
            checkId,
            taskId: task.publicId,
            assigned: Boolean(assigneeId),
            reason: note,
          }),
        },
      });
      return { checkId, taskId: task.publicId, assigned: Boolean(assigneeId) };
    });
  }

  async annexure(actor: Actor, period: AnnexurePeriod, departmentId?: string) {
    const { since, rows } = await fetchAnnexureRows(
      this.prisma,
      actor,
      period,
      departmentId,
    );
    const colours: Record<string, number> = {};
    for (const row of rows)
      colours[row.colour ?? "NONE"] = (colours[row.colour ?? "NONE"] ?? 0) + 1;
    return {
      period,
      since,
      total: rows.length,
      colours,
      items: rows.slice(0, 200),
    };
  }

  async annexureCsv(
    actor: Actor,
    period: AnnexurePeriod,
    columnList?: string,
    departmentId?: string,
  ) {
    const { rows } = await fetchAnnexureRows(
      this.prisma,
      actor,
      period,
      departmentId,
    );
    const { columns, file } = buildAnnexureCsvFile(period, rows, columnList);
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "workflow.team-annexure-exported",
        resourceType: "annexure",
        resourcePublicId: period,
        afterJson: JSON.stringify({ period, rows: rows.length, columns }),
      },
    });
    return file;
  }
}

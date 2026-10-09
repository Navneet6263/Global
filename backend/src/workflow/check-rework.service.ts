import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { updateCaseRisk } from "../verification/case-risk";
import {
  DispositionLabels,
  effectiveDisposition,
} from "../verification/dispositions";
import { restartCheckMethods } from "../verification/restart-check-methods";
import { checkStatusLabel } from "../verification/verified-fields";

export type ReworkMode = "REOPEN" | "REINITIATE" | "REJECT";
export type AnnexurePeriod = "week" | "month" | "year";

/** QA and later stages have their own return paths; rework is for live verification. */
const ACTIVE_CASE = ["IN_PROGRESS", "CLARIFICATION_PENDING"];
const MODE_TEXT: Record<ReworkMode, { audit: string; task: string }> = {
  REOPEN: { audit: "check.utv-reopened", task: "Re-opened from UTV" },
  REINITIATE: {
    audit: "check.utv-reinitiated",
    task: "Re-initiated from UTV",
  },
  REJECT: { audit: "check.rejected-by-lead", task: "Sent back by Team Leader" },
};

const IST_DATE = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** First instant of the current IST week (Monday), month or year. */
export function periodStart(period: AnnexurePeriod, now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const start = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()),
  );
  if (period === "week")
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (period === "month") start.setUTCDate(1);
  if (period === "year") start.setUTCMonth(0, 1);
  return new Date(start.getTime() - 330 * 60_000);
}

/** Byte-order mark so Excel opens the UTF-8 CSV correctly. */
const BOM = String.fromCharCode(0xfeff);

const csvCell = (value: string | number | null | undefined) => {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
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
      actor.roles.some((role) =>
        ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
      ) ||
      (actor.departments ?? []).some((department) => department.role === "LEAD")
    );
  }

  async utvBucket(
    actor: Actor,
    query: { page: number; pageSize: number; search?: string },
  ) {
    const search = query.search?.trim();
    const where: Prisma.CaseCheckWhereInput = {
      tenantId: actor.tenantId,
      result: "UNABLE_TO_VERIFY",
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
        select: {
          publicId: true,
          type: true,
          status: true,
          sourceSummary: true,
          completedAt: true,
          case: {
            select: {
              publicId: true,
              caseNumber: true,
              status: true,
              client: { select: { displayName: true } },
              subject: { select: { fullName: true } },
            },
          },
          tasks: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { assignee: { select: { displayName: true } } },
          },
        },
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
        canRework: canAct && ACTIVE_CASE.includes(row.case.status),
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
    const note = reason.trim();
    return this.prisma.$transaction(async (tx) => {
      const check = await tx.caseCheck.findFirst({
        where: {
          publicId: checkId,
          tenantId: actor.tenantId,
          case: caseAccessScope(actor),
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
      if (!ACTIVE_CASE.includes(check.case.status))
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

  private async annexureRows(actor: Actor, period: AnnexurePeriod) {
    const since = periodStart(period);
    const led = (actor.departments ?? [])
      .filter((department) => department.role === "LEAD")
      .map((department) => department.id);
    const manager = actor.roles.some((role) =>
      ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
    );
    if (!manager && !led.length)
      throw new ForbiddenException("The annexure is for Team Leaders");
    const rows = await this.prisma.caseCheck.findMany({
      where: {
        tenantId: actor.tenantId,
        status: "COMPLETED",
        completedAt: { gte: since },
        case: caseAccessScope(actor),
        ...(manager ? {} : { departmentId: { in: led } }),
      },
      orderBy: { completedAt: "desc" },
      take: 5000,
      select: {
        publicId: true,
        type: true,
        result: true,
        disposition: true,
        completedAt: true,
        case: {
          select: {
            publicId: true,
            caseNumber: true,
            status: true,
            client: { select: { displayName: true } },
            subject: { select: { fullName: true } },
          },
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { assignee: { select: { displayName: true } } },
        },
      },
    });
    return {
      since,
      rows: rows.map((row) => {
        const colour = effectiveDisposition(row);
        return {
          checkId: row.publicId,
          caseId: row.case.publicId,
          caseNumber: row.case.caseNumber,
          candidateName: row.case.subject.fullName,
          clientName: row.case.client.displayName,
          checkType: row.type,
          verifier: row.tasks[0]?.assignee?.displayName ?? null,
          completedAt: row.completedAt,
          status: checkStatusLabel(row.type, row.result, colour),
          colour,
          colourLabel: colour ? DispositionLabels[colour] : "Not set",
          canSendBack: ACTIVE_CASE.includes(row.case.status),
        };
      }),
    };
  }

  async annexure(actor: Actor, period: AnnexurePeriod) {
    const { since, rows } = await this.annexureRows(actor, period);
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

  async annexureCsv(actor: Actor, period: AnnexurePeriod, columnList?: string) {
    const { rows } = await this.annexureRows(actor, period);
    type Row = (typeof rows)[number];
    const all: Record<string, [string, (row: Row) => string]> = {
      caseNumber: ["Sapling ID", (row) => row.caseNumber],
      candidate: ["Candidate", (row) => row.candidateName],
      client: ["Client", (row) => row.clientName],
      check: ["Check", (row) => row.checkType.replaceAll("_", " ")],
      verifier: ["Verifier", (row) => row.verifier ?? ""],
      completedAt: [
        "Completed (IST)",
        (row) => (row.completedAt ? IST_DATE.format(row.completedAt) : ""),
      ],
      status: ["Status", (row) => row.status],
      colour: ["Colour code", (row) => row.colourLabel],
    };
    const picked = (columnList ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key in all);
    const columns = picked.length ? picked : Object.keys(all);
    const header = columns.map((key) => all[key]![0]);
    const lines = rows.map((row) =>
      columns
        .map((key) => all[key]![1](row))
        .map(csvCell)
        .join(","),
    );
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
    return new StreamableFile(
      Buffer.from(`${BOM}${[header.join(","), ...lines].join("\r\n")}`),
      {
        type: "text/csv; charset=utf-8",
        disposition: `attachment; filename="Sapling-Global-team-annexure-${period}.csv"`,
      },
    );
  }
}

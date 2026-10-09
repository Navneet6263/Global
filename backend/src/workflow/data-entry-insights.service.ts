import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  StreamableFile,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { isSupervisor, ledDepartmentIds } from "./workflow-access";

const DAY = 86_400_000;
const IST_OFFSET = 330 * 60_000;

/** Start of the IST day `daysAgo` days before `now`. */
export function istDayStart(now: Date, daysAgo = 0) {
  const ist = new Date(now.getTime() + IST_OFFSET);
  return new Date(
    Date.UTC(
      ist.getUTCFullYear(),
      ist.getUTCMonth(),
      ist.getUTCDate() - daysAgo,
    ) - IST_OFFSET,
  );
}
const istDayKey = (value: Date) =>
  new Date(value.getTime() + IST_OFFSET).toISOString().slice(0, 10);

export const DATA_ENTRY_REPORT_COLUMNS = {
  caseNumber: "Sapling ID",
  candidate: "Candidate",
  client: "Company",
  dataEntry: "Data Entry",
  assignedAt: "Assigned",
  readyAt: "Marked Ready",
  turnaroundHours: "Turnaround (hours)",
  stage: "Stage",
  checks: "Checks",
  checksInitiated: "Checks initiated",
  l1Raised: "L1 raised",
} as const;
export type DataEntryReportColumn = keyof typeof DATA_ENTRY_REPORT_COLUMNS;

const STAGE_LABELS: Record<string, string> = {
  DATA_ENTRY: "With Data Entry",
  CORRECTION: "Correction",
  READY: "Ready for RM",
  ROUTED: "Sent to teams",
  INTAKE: "With RM",
  CLIENT_REVIEW: "Client review",
};

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const BOM = String.fromCharCode(0xfeff);
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};
const hours = (from: Date | null, to: Date | null) =>
  from && to
    ? Math.max(
        0,
        Math.round(((to.getTime() - from.getTime()) / 3_600_000) * 10) / 10,
      )
    : null;

/**
 * Data Entry workspace numbers and reports: what is waiting, what was marked Ready
 * (today / week / month, 14-day trend), turnaround, L1s raised, pending by company,
 * and a Team Leader's team view; plus a column-picked report and CSV. Read-only.
 */
@Injectable()
export class DataEntryInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Whose work: the person, or (Team Leader / Operations asking for "team") the team. */
  private people(actor: Actor, scope: "mine" | "team") {
    const supervisor = isSupervisor(actor);
    if (!supervisor && !actor.roles.includes("DATA_ENTRY"))
      throw new ForbiddenException("This is the Data Entry workspace");
    const leads = ledDepartmentIds(actor, "DATA_ENTRY");
    if (scope === "mine" || (!leads.length && !supervisor))
      return {
        team: false,
        where: {
          dataEntryUserId: actor.userId,
        } as Prisma.VerificationCaseWhereInput,
      };
    return {
      team: true,
      where: (supervisor
        ? { dataEntryUserId: { not: null } }
        : {
            dataEntryUser: {
              departmentMemberships: { some: { departmentId: { in: leads } } },
            },
          }) as Prisma.VerificationCaseWhereInput,
    };
  }

  async overview(
    actor: Actor,
    scope: "mine" | "team" = "mine",
    now = new Date(),
  ) {
    const who = this.people(actor, scope);
    const base: Prisma.VerificationCaseWhereInput = {
      ...caseAccessScope(actor),
      workflowVersion: 2,
      AND: [who.where],
    };
    const since30 = new Date(now.getTime() - 30 * DAY);
    const trendFrom = istDayStart(now, 13);
    const [inQueue, corrections, readyRows, pending, recent, l1Raised] =
      await Promise.all([
        this.prisma.verificationCase.count({
          where: { ...base, intakeStage: "DATA_ENTRY" },
        }),
        this.prisma.verificationCase.count({
          where: { ...base, intakeStage: "CORRECTION" },
        }),
        this.prisma.verificationCase.findMany({
          where: { ...base, dataEntryReadyAt: { gte: since30 } },
          take: 5000,
          select: {
            dataEntryReadyAt: true,
            dataEntryAssignedAt: true,
            dataEntryUser: { select: { publicId: true, displayName: true } },
          },
        }),
        this.prisma.verificationCase.findMany({
          where: { ...base, intakeStage: { in: ["DATA_ENTRY", "CORRECTION"] } },
          take: 2000,
          select: {
            dueAt: true,
            client: { select: { displayName: true } },
            dataEntryUser: { select: { publicId: true, displayName: true } },
          },
        }),
        this.prisma.verificationCase.findMany({
          where: { ...base, dataEntryReadyAt: { not: null } },
          orderBy: { dataEntryReadyAt: "desc" },
          take: 8,
          select: {
            publicId: true,
            caseNumber: true,
            dataEntryReadyAt: true,
            dataEntryAssignedAt: true,
            client: { select: { displayName: true } },
            subject: { select: { fullName: true } },
            dataEntryUser: { select: { displayName: true } },
          },
        }),
        this.prisma.clarification.count({
          where: {
            tenantId: actor.tenantId,
            level: "L1",
            createdAt: { gte: since30 },
            case: base,
            ...(who.team ? {} : { raisedById: actor.userId }),
          },
        }),
      ]);
    const today = istDayStart(now);
    const weekStart = istDayStart(
      now,
      (new Date(now.getTime() + IST_OFFSET).getUTCDay() + 6) % 7,
    );
    const monthStart = istDayStart(
      now,
      new Date(now.getTime() + IST_OFFSET).getUTCDate() - 1,
    );
    const done = readyRows.filter((row) => row.dataEntryReadyAt);
    const turnaround = done
      .map((row) => hours(row.dataEntryAssignedAt, row.dataEntryReadyAt))
      .filter((value): value is number => value !== null);
    const trend = Array.from({ length: 14 }, (_, index) => {
      const day = istDayStart(now, 13 - index);
      const key = istDayKey(day);
      return {
        day: key,
        ready: done.filter(
          (row) =>
            row.dataEntryReadyAt! >= trendFrom &&
            istDayKey(row.dataEntryReadyAt!) === key,
        ).length,
      };
    });
    const byClient = new Map<string, number>();
    for (const row of pending)
      byClient.set(
        row.client.displayName,
        (byClient.get(row.client.displayName) ?? 0) + 1,
      );
    const team = new Map<
      string,
      { name: string; inQueue: number; readyThisWeek: number }
    >();
    if (who.team) {
      for (const row of pending)
        if (row.dataEntryUser) {
          const entry = team.get(row.dataEntryUser.publicId) ?? {
            name: row.dataEntryUser.displayName,
            inQueue: 0,
            readyThisWeek: 0,
          };
          entry.inQueue += 1;
          team.set(row.dataEntryUser.publicId, entry);
        }
      for (const row of done)
        if (row.dataEntryUser && row.dataEntryReadyAt! >= weekStart) {
          const entry = team.get(row.dataEntryUser.publicId) ?? {
            name: row.dataEntryUser.displayName,
            inQueue: 0,
            readyThisWeek: 0,
          };
          entry.readyThisWeek += 1;
          team.set(row.dataEntryUser.publicId, entry);
        }
    }
    return {
      scope: who.team ? "team" : "mine",
      canSeeTeam:
        isSupervisor(actor) || ledDepartmentIds(actor, "DATA_ENTRY").length > 0,
      kpis: {
        inQueue,
        corrections,
        overdue: pending.filter((row) => row.dueAt && row.dueAt < now).length,
        readyToday: done.filter((row) => row.dataEntryReadyAt! >= today).length,
        readyThisWeek: done.filter((row) => row.dataEntryReadyAt! >= weekStart)
          .length,
        readyThisMonth: done.filter(
          (row) => row.dataEntryReadyAt! >= monthStart,
        ).length,
        averageTurnaroundHours: turnaround.length
          ? Math.round(
              (turnaround.reduce((sum, value) => sum + value, 0) /
                turnaround.length) *
                10,
            ) / 10
          : null,
        l1Raised30d: l1Raised,
      },
      trend,
      pendingByClient: [...byClient.entries()]
        .map(([client, count]) => ({ client, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      recent: recent.map((row) => ({
        caseId: row.publicId,
        caseNumber: row.caseNumber,
        candidateName: row.subject.fullName,
        clientName: row.client.displayName,
        dataEntry: row.dataEntryUser?.displayName ?? null,
        readyAt: row.dataEntryReadyAt,
        turnaroundHours: hours(row.dataEntryAssignedAt, row.dataEntryReadyAt),
      })),
      team: [...team.values()].sort((a, b) => b.inQueue - a.inQueue),
      generatedAt: now,
    };
  }

  private async reportRows(
    actor: Actor,
    input: { from?: string; to?: string; scope?: "mine" | "team" },
  ) {
    const who = this.people(actor, input.scope ?? "mine");
    const to = input.to
      ? new Date(`${input.to}T23:59:59.999+05:30`)
      : new Date();
    const from = input.from
      ? new Date(`${input.from}T00:00:00+05:30`)
      : new Date(to.getTime() - 30 * DAY);
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      from > to
    )
      throw new BadRequestException("Choose a valid date range");
    if (to.getTime() - from.getTime() > 366 * DAY)
      throw new BadRequestException("Choose a range of one year or less");
    const rows = await this.prisma.verificationCase.findMany({
      where: {
        ...caseAccessScope(actor),
        workflowVersion: 2,
        AND: [
          who.where,
          {
            OR: [
              { dataEntryAssignedAt: { gte: from, lte: to } },
              { dataEntryReadyAt: { gte: from, lte: to } },
            ],
          },
        ],
      },
      orderBy: { dataEntryAssignedAt: "desc" },
      take: 5000,
      select: {
        caseNumber: true,
        intakeStage: true,
        dataEntryAssignedAt: true,
        dataEntryReadyAt: true,
        client: { select: { displayName: true } },
        subject: { select: { fullName: true } },
        dataEntryUser: { select: { displayName: true } },
        checks: { select: { initiatedAt: true } },
        _count: { select: { clarifications: { where: { level: "L1" } } } },
      },
    });
    return {
      from,
      to,
      rows: rows.map((row) => ({
        caseNumber: row.caseNumber,
        candidate: row.subject.fullName,
        client: row.client.displayName,
        dataEntry: row.dataEntryUser?.displayName ?? "",
        assignedAt: row.dataEntryAssignedAt,
        readyAt: row.dataEntryReadyAt,
        turnaroundHours: hours(row.dataEntryAssignedAt, row.dataEntryReadyAt),
        stage: STAGE_LABELS[row.intakeStage ?? ""] ?? row.intakeStage ?? "",
        checks: row.checks.length,
        checksInitiated: row.checks.filter((check) => check.initiatedAt).length,
        l1Raised: row._count.clarifications,
      })),
    };
  }

  async report(
    actor: Actor,
    input: { from?: string; to?: string; scope?: "mine" | "team" },
  ) {
    const { from, to, rows } = await this.reportRows(actor, input);
    return {
      from,
      to,
      total: rows.length,
      summary: {
        markedReady: rows.filter((row) => row.readyAt).length,
        averageTurnaroundHours: (() => {
          const values = rows
            .map((row) => row.turnaroundHours)
            .filter((v): v is number => v !== null);
          return values.length
            ? Math.round(
                (values.reduce((a, b) => a + b, 0) / values.length) * 10,
              ) / 10
            : null;
        })(),
        l1Raised: rows.reduce((sum, row) => sum + row.l1Raised, 0),
      },
      rows: rows.slice(0, 200),
    };
  }

  async exportCsv(
    actor: Actor,
    input: {
      from?: string;
      to?: string;
      scope?: "mine" | "team";
      columns?: string;
    },
  ) {
    const { rows } = await this.reportRows(actor, input);
    const all = Object.keys(
      DATA_ENTRY_REPORT_COLUMNS,
    ) as DataEntryReportColumn[];
    const picked = (input.columns ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter((key): key is DataEntryReportColumn =>
        all.includes(key as never),
      );
    const columns = picked.length ? picked : all;
    const format = (
      row: (typeof rows)[number],
      column: DataEntryReportColumn,
    ) => {
      const value = row[column];
      if (value instanceof Date) return IST.format(value);
      return value === null || value === undefined ? "" : String(value);
    };
    const csv = `${BOM}${[
      columns.map((column) => DATA_ENTRY_REPORT_COLUMNS[column]),
      ...rows.map((row) => columns.map((column) => format(row, column))),
    ]
      .map((line) => line.map(cell).join(","))
      .join("\r\n")}`;
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "data-entry.report-exported",
        resourceType: "report",
        resourcePublicId: "data-entry",
        afterJson: JSON.stringify({
          rows: rows.length,
          columns,
          scope: input.scope ?? "mine",
        }),
      },
    });
    return new StreamableFile(Buffer.from(csv), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="Sapling-Global-data-entry-report.csv"`,
    });
  }
}

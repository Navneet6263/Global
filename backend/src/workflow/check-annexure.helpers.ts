import { ForbiddenException, StreamableFile } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { hasAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import type { Prisma } from "../generated/prisma/client";
import type { PrismaService } from "../database/prisma.service";
import {
  resolveVerificationDepartmentId,
  verificationLedDepartmentIds,
} from "../verification/task-query.helpers";
import { checkStatusLabel } from "../verification/verified-fields";
import {
  DispositionLabels,
  effectiveDisposition,
} from "../verification/dispositions";

export type AnnexurePeriod = "week" | "month" | "year";

export const ACTIVE_REWORK_CASE_STATUSES = [
  "IN_PROGRESS",
  "CLARIFICATION_PENDING",
];

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

export type AnnexureRawRow = {
  publicId: string;
  type: string;
  result: string | null;
  disposition: string | null;
  completedAt: Date | null;
  case: {
    publicId: string;
    caseNumber: string;
    status: string;
    client: { displayName: string };
    subject: { fullName: string };
  };
  tasks: Array<{ assignee: { displayName: string } | null }>;
};

export function mapAnnexureRow(row: AnnexureRawRow) {
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
    canSendBack: ACTIVE_REWORK_CASE_STATUSES.includes(row.case.status),
  };
}

export const UTV_ROW_SELECT = {
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
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { assignee: { select: { displayName: true } } },
  },
} satisfies Prisma.CaseCheckSelect;

export async function fetchAnnexureRows(
  prisma: PrismaService,
  actor: Actor,
  period: AnnexurePeriod,
  departmentId?: string,
) {
  const since = periodStart(period);
  const led = verificationLedDepartmentIds(actor);
  const manager = hasAnyRole(actor, OPERATIONS_ROLES);
  if (!manager && !led.length)
    throw new ForbiddenException("The annexure is for Team Leaders");
  const resolvedDepartment = await resolveVerificationDepartmentId(
    prisma,
    actor,
    departmentId,
  );
  const rows = await prisma.caseCheck.findMany({
    where: {
      tenantId: actor.tenantId,
      status: "COMPLETED",
      completedAt: { gte: since },
      case: caseAccessScope(actor),
      ...(resolvedDepartment !== undefined
        ? { departmentId: resolvedDepartment }
        : manager
          ? {}
          : { departmentId: { in: led } }),
    },
    orderBy: { completedAt: "desc" },
    take: 5000,
    select: {
      publicId: true,
      type: true,
      result: true,
      disposition: true,
      completedAt: true,
      case: UTV_ROW_SELECT.case,
      tasks: UTV_ROW_SELECT.tasks,
    },
  });
  return { since, rows: rows.map(mapAnnexureRow) };
}

export function buildAnnexureCsvFile(
  period: AnnexurePeriod,
  rows: ReturnType<typeof mapAnnexureRow>[],
  columnList?: string,
) {
  type Row = ReturnType<typeof mapAnnexureRow>;
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
  return {
    columns,
    file: new StreamableFile(
      Buffer.from(`${BOM}${[header.join(","), ...lines].join("\r\n")}`),
      {
        type: "text/csv; charset=utf-8",
        disposition: `attachment; filename="Sapling-Global-team-annexure-${period}.csv"`,
      },
    ),
  };
}

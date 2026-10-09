import type { Prisma } from "../generated/prisma/client";
import {
  VENDOR_EXPORT_COLUMNS,
  ageDays,
  ageingBucket,
  OPEN_VENDOR_STATUSES,
  type VendorCheckStatus,
  type VendorExportColumn,
} from "./vendor-check-rules";

export const vendorRowSelect = {
  publicId: true,
  attempt: true,
  status: true,
  dueAt: true,
  note: true,
  result: true,
  remarks: true,
  declineReason: true,
  reviewNote: true,
  assignedAs: true,
  requestReason: true,
  approvalNote: true,
  approvedAt: true,
  acceptedAt: true,
  submittedAt: true,
  reviewedAt: true,
  version: true,
  createdAt: true,
  check: { select: { publicId: true, type: true } },
  case: {
    select: {
      publicId: true,
      caseNumber: true,
      subject: { select: { fullName: true } },
    },
  },
  client: { select: { displayName: true } },
  vendor: { select: { publicId: true, displayName: true } },
  handler: { select: { publicId: true, displayName: true } },
  assignedBy: { select: { displayName: true } },
  reviewedBy: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
  _count: { select: { evidence: true } },
} satisfies Prisma.VendorCheckAssignmentSelect;

export type VendorRow = Prisma.VendorCheckAssignmentGetPayload<{
  select: typeof vendorRowSelect;
}>;

export function toVendorRow(row: VendorRow, now = new Date()) {
  const open = OPEN_VENDOR_STATUSES.includes(row.status as VendorCheckStatus);
  const days = ageDays(row.createdAt, now);
  return {
    id: row.publicId,
    attempt: row.attempt,
    status: row.status,
    checkId: row.check.publicId,
    checkType: row.check.type,
    caseId: row.case.publicId,
    caseNumber: row.case.caseNumber,
    candidateName: row.case.subject.fullName,
    clientName: row.client.displayName,
    vendor: { id: row.vendor.publicId, name: row.vendor.displayName },
    handler: row.handler
      ? { id: row.handler.publicId, name: row.handler.displayName }
      : null,
    assignedBy: row.assignedBy.displayName,
    reviewedBy: row.reviewedBy?.displayName ?? null,
    note: row.note,
    dueAt: row.dueAt,
    assignedAt: row.createdAt,
    acceptedAt: row.acceptedAt,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    result: row.result,
    remarks: row.remarks,
    declineReason: row.declineReason,
    reviewNote: row.reviewNote,
    assignedAs: row.assignedAs,
    requestReason: row.requestReason,
    approval: row.approvedAt
      ? {
          by: row.approvedBy?.displayName ?? null,
          at: row.approvedAt,
          note: row.approvalNote,
        }
      : null,
    evidenceCount: row._count.evidence,
    version: row.version,
    ageDays: days,
    ageing: open ? ageingBucket(days) : null,
    overdue: open && Boolean(row.dueAt && row.dueAt < now),
  };
}

export type VendorRowView = ReturnType<typeof toVendorRow>;

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const day = (value: Date | null) => (value ? IST.format(value) : "");
const readable = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

const BOM = String.fromCharCode(0xfeff);
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

/** CSV with only the columns the user picked, in the standard order. */
export function vendorCsv(
  rows: readonly VendorRowView[],
  columns: readonly VendorExportColumn[],
) {
  const value: Record<VendorExportColumn, (row: VendorRowView) => string> = {
    caseNumber: (row) => row.caseNumber,
    candidate: (row) => row.candidateName,
    client: (row) => row.clientName,
    check: (row) => readable(row.checkType),
    vendor: (row) => row.vendor.name,
    handler: (row) => row.handler?.name ?? row.vendor.name,
    status: (row) => readable(row.status),
    assignedAt: (row) => day(row.assignedAt),
    dueAt: (row) => day(row.dueAt),
    ageDays: (row) => String(row.ageDays),
    overdue: (row) => (row.overdue ? "Yes" : "No"),
    submittedAt: (row) => day(row.submittedAt),
    result: (row) => (row.result ? readable(row.result) : ""),
    reviewedAt: (row) => day(row.reviewedAt),
  };
  return `${BOM}${[
    columns.map((column) => VENDOR_EXPORT_COLUMNS[column]),
    ...rows.map((row) => columns.map((column) => value[column](row))),
  ]
    .map((line) => line.map(cell).join(","))
    .join("\r\n")}`;
}

/** KPI counts and ageing buckets for a board. */
export function boardSummary(rows: readonly VendorRowView[]) {
  const counts: Record<string, number> = {};
  const ageing: Record<string, number> = {
    "0-2": 0,
    "3-5": 0,
    "6-10": 0,
    "10+": 0,
  };
  let overdue = 0;
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    if (row.ageing) ageing[row.ageing] = (ageing[row.ageing] ?? 0) + 1;
    if (row.overdue) overdue += 1;
  }
  return { counts, ageing, overdue };
}

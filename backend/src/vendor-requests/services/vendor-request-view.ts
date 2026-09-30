import type { Prisma } from "../../generated/prisma/client";
import { canRemindNow } from "./vendor-team-rules";
import type {
  vendorDetailSelect,
  vendorListSelect,
} from "../vendor-requests.repository";

type ListRow = Prisma.VendorAssignmentGetPayload<{
  select: typeof vendorListSelect;
}>;
type DetailRow = Prisma.VendorAssignmentGetPayload<{
  select: typeof vendorDetailSelect;
}>;

/** A report as both sides see it: never the storage key or the uploaded file name path. */
export function toReportView(report: {
  publicId: string;
  version: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy: { displayName: string };
}) {
  return {
    id: report.publicId,
    version: report.version,
    name: report.originalName,
    contentType: report.contentType,
    sizeBytes: report.sizeBytes,
    uploadedAt: report.createdAt,
    uploadedBy: report.uploadedBy.displayName,
  };
}

/** What an assign / re-assign returns to the SPOC-RM. */
export function toAssignmentResult(
  row: {
    publicId: string;
    attempt: number;
    status: string;
    version: number;
    documentVersion: number;
    createdAt: Date;
  },
  vendor: { publicId: string; displayName: string },
) {
  return {
    id: row.publicId,
    attempt: row.attempt,
    status: row.status,
    version: row.version,
    documentVersion: row.documentVersion,
    assignedAt: row.createdAt,
    vendor: { id: vendor.publicId, name: vendor.displayName },
  };
}

/** One row of the vendor's own request list. */
export function toVendorListItem(row: ListRow) {
  return {
    id: row.publicId,
    attempt: row.attempt,
    status: row.status,
    documentType: row.document.type,
    caseNumber: row.case.caseNumber,
    clientName: row.client.displayName,
    assignedBy: row.assignedBy.displayName,
    assignedAt: row.createdAt,
    decidedAt: row.decidedAt,
    handledBy: row.handler?.displayName ?? null,
    hasReport: row._count.reports > 0,
  };
}

/** The vendor's request detail with only the pinned file version. */
export function toVendorDetail(
  row: DetailRow,
  file: {
    originalName: string;
    contentType: string;
    sizeBytes: bigint;
    createdAt: Date;
  } | null,
  mainVendor: boolean,
) {
  const pending = row.status === "PENDING";
  return {
    id: row.publicId,
    attempt: row.attempt,
    status: row.status,
    version: row.version,
    documentType: row.document.type,
    caseNumber: row.case.caseNumber,
    candidateName: row.case.subject.fullName,
    clientName: row.client.displayName,
    assignedBy: row.assignedBy.displayName,
    assignedAt: row.createdAt,
    note: row.assignmentNote,
    resolutionNote: row.resolutionNote,
    decidedAt: row.decidedAt,
    reason: row.decisionReason,
    // Delegation belongs to the Main Vendor; the server re-checks every action.
    handler: row.handler
      ? { id: row.handler.publicId, name: row.handler.displayName }
      : null,
    delegatedAt: row.delegatedAt,
    lastRemindedAt: row.lastRemindedAt,
    canDelegate: mainVendor && pending,
    canRemind:
      mainVendor &&
      pending &&
      row.handlerUserId !== null &&
      canRemindNow(row.lastRemindedAt),
    // Approve first, then upload: only an APPROVED request takes a report.
    report: row.reports[0] ? toReportView(row.reports[0]) : null,
    canUploadReport: row.status === "APPROVED",
    file: file
      ? {
          version: row.documentVersion,
          name: file.originalName,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes.toString(),
          uploadedAt: file.createdAt,
        }
      : null,
  };
}

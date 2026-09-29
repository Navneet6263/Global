import type { Prisma } from "../../generated/prisma/client";
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
) {
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

import type { RequesterRow, SupportRequestRow } from "../support.repository";

/** A support request as the agent inbox shows it. */
export function toSupportRequest(row: SupportRequestRow, viewerId?: bigint) {
  return {
    id: row.publicId,
    requestNumber: row.requestNumber,
    requesterType: row.requesterType,
    requesterName:
      row.requesterType === "CANDIDATE"
        ? (row.case?.subject.fullName ?? "Candidate")
        : (row.requester?.displayName ?? "Client Admin"),
    client: { id: row.client.publicId, displayName: row.client.displayName },
    employee: row.case
      ? {
          caseId: row.case.publicId,
          caseNumber: row.case.caseNumber,
          candidateName: row.case.subject.fullName,
          caseStatus: row.case.status,
        }
      : null,
    subject: row.subject,
    message: row.message,
    status: row.status,
    takenBy: row.assignedTo?.displayName ?? null,
    takenByMe: viewerId !== undefined && row.assignedToId === viewerId,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** A request as its own requester (candidate or Client Admin) sees it. */
export function toRequesterView(row: RequesterRow) {
  return {
    id: row.publicId,
    requestNumber: row.requestNumber,
    subject: row.subject,
    caseNumber: row.case?.caseNumber ?? null,
    status: row.status,
    reply: row.resolutionNote,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

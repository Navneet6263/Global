import {
  documentVendorStatus,
  latestAttempt,
  nextVendorAction,
  reuploadState,
} from "./vendor-rules";
import { toReportView } from "./vendor-request-view";

/** Row shapes and mappers for the SPOC-RM Vendors page (list and detail drawer). */
type AttemptRow = {
  publicId: string;
  attempt: number;
  status: string;
  version: number;
  documentVersion: number;
  assignmentNote: string | null;
  resolutionNote: string | null;
  decisionReason: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  vendor: { publicId: string; displayName: string };
  assignedBy: { displayName: string };
  decidedBy: { displayName: string } | null;
  reports: Parameters<typeof toReportView>[0][];
};

type DocumentRow = {
  publicId: string;
  type: string;
  status: string;
  version: number;
  currentVersion: number;
  reviewNote: string | null;
  reviewedAt: Date | null;
  updatedAt: Date;
  case: {
    id: bigint;
    publicId: string;
    caseNumber: string;
    status: string;
    subject: { fullName: string };
    client: { publicId: string; displayName: string };
  };
  versions: Array<{
    version: number;
    originalName: string;
    contentType: string;
    sizeBytes: bigint;
    createdAt: Date;
  }>;
  vendorAssignments: AttemptRow[];
};

export function toHistory(row: AttemptRow) {
  return {
    id: row.publicId,
    attempt: row.attempt,
    status: row.status,
    version: row.version,
    documentVersion: row.documentVersion,
    vendor: { id: row.vendor.publicId, name: row.vendor.displayName },
    assignedBy: row.assignedBy.displayName,
    assignedAt: row.createdAt,
    note: row.assignmentNote,
    resolutionNote: row.resolutionNote,
    decidedBy: row.decidedBy?.displayName ?? null,
    decidedAt: row.decidedAt,
    reason: row.decisionReason,
    // SPOC-RM receives a vendor report only for an approved attempt.
    report:
      row.status === "APPROVED" && row.reports[0]
        ? toReportView(row.reports[0])
        : null,
  };
}

export function toDocument(row: DocumentRow) {
  const file = row.versions[0];
  const latest = latestAttempt(row.vendorAssignments);
  const state = reuploadState(row.vendorAssignments, row.status, file?.version);
  return {
    id: row.publicId,
    type: row.type,
    internalStatus: row.status,
    version: row.version,
    caseId: row.case.publicId,
    caseNumber: row.case.caseNumber,
    caseStatus: row.case.status,
    candidateName: row.case.subject.fullName,
    updatedAt: row.updatedAt,
    file: file
      ? {
          version: file.version,
          name: file.originalName,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes.toString(),
          uploadedAt: file.createdAt,
        }
      : null,
    vendorStatus: documentVendorStatus(row.vendorAssignments),
    current: latest ? toHistory(latest) : null,
    // The candidate-facing message is shown only while the re-upload is awaited;
    // the existing upload flow clears it, and the audit trail keeps the history.
    reupload: {
      state,
      message: state === "REQUESTED" ? row.reviewNote : null,
      requestedAt: state === "REQUESTED" ? row.reviewedAt : null,
    },
    ...nextVendorAction(
      row.vendorAssignments,
      row.case.status,
      Boolean(file),
      row.status,
    ),
  };
}

/** Audit rows of re-upload requests; malformed JSON is skipped, never thrown. */
export function reuploadEntry(row: {
  createdAt: Date;
  afterJson: string | null;
  actor: { displayName: string } | null;
}) {
  try {
    const after = JSON.parse(row.afterJson ?? "{}") as {
      message?: unknown;
      documentVersion?: unknown;
      attempt?: unknown;
    };
    return {
      requestedAt: row.createdAt,
      requestedBy: row.actor?.displayName ?? null,
      message: typeof after.message === "string" ? after.message : null,
      documentVersion:
        typeof after.documentVersion === "number"
          ? after.documentVersion
          : null,
      attempt: typeof after.attempt === "number" ? after.attempt : null,
    };
  } catch {
    return null;
  }
}

interface ClientCard {
  id: bigint;
  publicId: string;
  code: string;
  displayName: string;
  status: string;
}

interface ChainRow {
  clientId: bigint;
  documentId: bigint;
  attempt: number;
  status: string;
}

/** Per client: uploaded documents and the latest vendor status of each document's chain. */
export function toClientRollup(
  clients: readonly ClientCard[],
  documents: readonly { case: { clientId: bigint } }[],
  attempts: readonly ChainRow[],
) {
  const chains = new Map<string, ChainRow>();
  for (const row of attempts) {
    const current = chains.get(String(row.documentId));
    if (!current || row.attempt > current.attempt)
      chains.set(String(row.documentId), row);
  }
  return clients.map((client) => {
    const key = String(client.id);
    const uploaded = documents.filter(
      (row) => String(row.case.clientId) === key,
    ).length;
    const own = [...chains.values()].filter(
      (row) => String(row.clientId) === key,
    );
    const count = (status: string) =>
      own.filter((row) => row.status === status).length;
    return {
      id: client.publicId,
      code: client.code,
      displayName: client.displayName,
      status: client.status,
      uploaded,
      notAssigned: Math.max(0, uploaded - own.length),
      pending: count("PENDING"),
      approved: count("APPROVED"),
      rejected: count("REJECTED"),
    };
  });
}

/** Every clean version; candidate uploads carry no user, staff uploads show the uploader. */
export function toVersionHistory(
  versions: readonly {
    version: number;
    createdAt: Date;
    uploadedById: bigint | null;
  }[],
  uploaders: readonly { id: bigint; displayName: string }[],
) {
  const names = new Map(
    uploaders.map((user) => [String(user.id), user.displayName]),
  );
  return versions.map((version) => ({
    version: version.version,
    uploadedAt: version.createdAt,
    uploadedBy:
      version.uploadedById === null
        ? "Candidate"
        : (names.get(String(version.uploadedById)) ?? "Staff"),
  }));
}

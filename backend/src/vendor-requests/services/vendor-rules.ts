import { BadRequestException, ConflictException } from "@nestjs/common";
import { DOCUMENT_UPLOAD_ALLOWED_CASE_STATUSES } from "../../documents/upload-document-policy";

export const VendorAssignmentStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type VendorAssignmentStatus = (typeof VendorAssignmentStatuses)[number];

export const VendorDecisions = ["APPROVED", "REJECTED"] as const;
export type VendorDecision = (typeof VendorDecisions)[number];

/** A document's vendor status as the SPOC side sees it (latest attempt wins). */
export const VendorDocumentStatuses = [
  "NOT_ASSIGNED",
  ...VendorAssignmentStatuses,
] as const;
export type VendorDocumentStatus = (typeof VendorDocumentStatuses)[number];

/** No new vendor work starts on a case in these stages. */
export const VENDOR_BLOCKED_CASE_STATUSES: readonly string[] = [
  "CANCELLED",
  "CLOSED",
];

export const VENDOR_TEXT_MIN = 5;
export const VENDOR_TEXT_MAX = 1000;

/** A mandatory note (rejection reason, resolution note), trimmed; blank or too short is refused. */
export function requiredText(value: string | undefined, label: string): string {
  const text = value?.trim() ?? "";
  if (text.length < VENDOR_TEXT_MIN || text.length > VENDOR_TEXT_MAX)
    throw new BadRequestException(
      `${label} must be ${VENDOR_TEXT_MIN} to ${VENDOR_TEXT_MAX} characters`,
    );
  return text;
}

export function optionalText(value: string | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/** The decision columns written for a vendor decision; a rejection must carry its reason. */
export function decisionFields(
  decision: VendorDecision,
  reason: string | undefined,
) {
  return {
    status: decision,
    decisionReason:
      decision === "REJECTED"
        ? requiredText(reason, "Rejection reason")
        : optionalText(reason),
  };
}

interface AttemptRow {
  attempt: number;
  status: string;
}

export function latestAttempt<T extends AttemptRow>(
  rows: readonly T[],
): T | undefined {
  return rows.reduce<T | undefined>(
    (latest, row) => (!latest || row.attempt > latest.attempt ? row : latest),
    undefined,
  );
}

export function documentVendorStatus(
  rows: readonly AttemptRow[],
): VendorDocumentStatus {
  const status = latestAttempt(rows)?.status;
  return status === "PENDING" || status === "APPROVED" || status === "REJECTED"
    ? status
    : "NOT_ASSIGNED";
}

/** The existing candidate-workflow state a SPOC-RM re-upload request puts a document in. */
export const REUPLOAD_REQUIRED = "REUPLOAD_REQUIRED";

/**
 * What the SPOC side may do next with a document. Assign starts a chain; only a
 * rejected latest attempt may be re-assigned or sent back for re-upload; APPROVED
 * closes the chain. While a re-upload is awaited, re-assign waits for the new file.
 */
export function nextVendorAction(
  rows: readonly AttemptRow[],
  caseStatus: string,
  hasCleanVersion: boolean,
  documentStatus?: string,
) {
  const open =
    hasCleanVersion && !VENDOR_BLOCKED_CASE_STATUSES.includes(caseStatus);
  const status = documentVendorStatus(rows);
  const awaitingUpload = documentStatus === REUPLOAD_REQUIRED;
  return {
    canAssign: open && status === "NOT_ASSIGNED",
    canReassign: open && status === "REJECTED" && !awaitingUpload,
    canRequestReupload:
      status === "REJECTED" &&
      !awaitingUpload &&
      DOCUMENT_UPLOAD_ALLOWED_CASE_STATUSES.has(caseStatus),
  };
}

export const ReuploadStates = ["NONE", "REQUESTED", "RECEIVED"] as const;
export type ReuploadState = (typeof ReuploadStates)[number];

/**
 * Where a rejected document stands in the re-upload loop: REQUESTED while the
 * candidate still has to upload, RECEIVED once a version newer than the rejected
 * one exists (ready to re-assign), NONE otherwise.
 */
export function reuploadState(
  rows: readonly (AttemptRow & { documentVersion: number })[],
  documentStatus: string,
  latestFileVersion: number | undefined,
): ReuploadState {
  const latest = latestAttempt(rows);
  if (latest?.status !== "REJECTED") return "NONE";
  if (documentStatus === REUPLOAD_REQUIRED) return "REQUESTED";
  return latestFileVersion !== undefined &&
    latestFileVersion > latest.documentVersion
    ? "RECEIVED"
    : "NONE";
}

/** Prisma filter for documents whose latest attempt has the given vendor status. */
export function vendorStatusWhere(status: VendorDocumentStatus | undefined) {
  if (!status) return {};
  if (status === "NOT_ASSIGNED") return { vendorAssignments: { none: {} } };
  // PENDING and APPROVED can only ever be the latest attempt of a chain.
  if (status !== "REJECTED") return { vendorAssignments: { some: { status } } };
  return {
    AND: [
      { vendorAssignments: { some: { status: "REJECTED" } } },
      {
        vendorAssignments: {
          none: { status: { in: ["PENDING", "APPROVED"] } },
        },
      },
    ],
  };
}

export function isUniqueConflict(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002",
  );
}

/** A second writer racing on the same (documentId, attempt) loses with 409, never a duplicate. */
export async function onAssignmentRace<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueConflict(error))
      throw new ConflictException(
        "This document was just assigned by someone else; refresh and try again",
      );
    throw error;
  }
}

export function documentLabel(type: string): string {
  const text = type.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

import { BadRequestException } from "@nestjs/common";

export const VENDOR_CHECK_STATUSES = [
  /** A Team Leader's request, waiting for the case RM (the vendor does not see it). */
  "PENDING_APPROVAL",
  /** The RM turned the Team Leader's request down. */
  "REJECTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED",
  "RETURNED",
  "APPROVED",
  "DECLINED",
  "CANCELLED",
] as const;
export type VendorCheckStatus = (typeof VENDOR_CHECK_STATUSES)[number];

/** Work the vendor still holds (counts toward ageing and reminders). */
export const OPEN_VENDOR_STATUSES: readonly VendorCheckStatus[] = [
  "ASSIGNED",
  "IN_PROGRESS",
  "RETURNED",
];
/** A check has at most one live vendor attempt. */
export const LIVE_VENDOR_STATUSES: readonly VendorCheckStatus[] = [
  "PENDING_APPROVAL",
  ...OPEN_VENDOR_STATUSES,
  "SUBMITTED",
];

export const VENDOR_RESULTS = [
  "CLEAR",
  "DISCREPANCY",
  "UNABLE_TO_VERIFY",
] as const;

/**
 * Documents shared with a vendor by default for each check (the assigner can tick more
 * or fewer). Until the package mapping arrives this is the manual mapping.
 */
export const VENDOR_CHECK_DOCUMENTS: Readonly<
  Record<string, readonly string[]>
> = {
  ADDRESS: ["ADDRESS_PROOF", "AADHAAR"],
  EMPLOYMENT: ["EMPLOYMENT_PROOF"],
  EDUCATION: ["EDUCATION_CERTIFICATE"],
  COURT_RECORD: ["AADHAAR", "ADDRESS_PROOF"],
  CRIMINAL: ["AADHAAR", "ADDRESS_PROOF"],
  DRUG_TEST: ["AADHAAR"],
  IDENTITY: ["AADHAAR"],
  PAN_VALIDATION: ["PAN"],
  REFERENCE: [],
};

export const defaultSharedTypes = (checkType: string) =>
  VENDOR_CHECK_DOCUMENTS[checkType.toUpperCase()] ?? [];

/** Proof files: PDF or images, 5 MB each, at most 10 per attempt. */
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_MAX_FILES = 10;
export const EVIDENCE_TYPES: readonly string[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

export function vendorText(
  value: string | undefined,
  label: string,
  min = 5,
  max = 1000,
) {
  const text = value?.trim() ?? "";
  if (text.length < min || text.length > max)
    throw new BadRequestException(
      `${label} must be ${min} to ${max} characters`,
    );
  return text;
}

export const parseJsonArray = <T>(json: string | null | undefined): T[] => {
  try {
    const value = JSON.parse(json ?? "[]") as unknown;
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
};

export type VendorSubmission = {
  entries: Array<Record<string, string>>;
};

export const parseSubmission = (json: string | null | undefined) => {
  try {
    const value = JSON.parse(json ?? "") as VendorSubmission;
    return Array.isArray(value.entries) ? value.entries : [];
  } catch {
    return [];
  }
};

/** Whole days since `from` (ageing). */
export const ageDays = (from: Date, now = new Date()) =>
  Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));

export const ageingBucket = (days: number) =>
  days <= 2 ? "0-2" : days <= 5 ? "3-5" : days <= 10 ? "6-10" : "10+";

/** Columns for the custom report (vendor and internal boards). */
export const VENDOR_EXPORT_COLUMNS = {
  caseNumber: "Sapling ID",
  candidate: "Candidate",
  client: "Client",
  check: "Check",
  vendor: "Vendor",
  handler: "Handled by",
  status: "Status",
  assignedAt: "Assigned",
  dueAt: "Due",
  ageDays: "Age (days)",
  overdue: "Overdue",
  submittedAt: "Submitted",
  result: "Result",
  reviewedAt: "Reviewed",
} as const;
export type VendorExportColumn = keyof typeof VENDOR_EXPORT_COLUMNS;

export function exportColumns(
  requested: string | undefined,
): VendorExportColumn[] {
  const all = Object.keys(VENDOR_EXPORT_COLUMNS) as VendorExportColumn[];
  if (!requested) return all;
  const chosen = requested
    .split(",")
    .map((key) => key.trim())
    .filter((key): key is VendorExportColumn => all.includes(key as never));
  return chosen.length ? chosen : all;
}

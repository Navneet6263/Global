import type { StatusTone } from "@/lib/contracts/common";
import type { VendorDecision, VendorRequestStatus } from "./vendor-contracts";

export const REASON_MIN = 5;
export const REASON_MAX = 1000;

/**
 * Mirrors the server rule: a rejection needs a reason of 5–1000 characters after
 * trimming; an approval remark is optional. The server remains the authority.
 */
export function decisionProblem(decision: VendorDecision, reason: string): string | null {
  const length = reason.trim().length;
  if (length > REASON_MAX) return `Keep it under ${REASON_MAX} characters.`;
  if (decision === "REJECTED" && length < REASON_MIN)
    return `A rejection reason of at least ${REASON_MIN} characters is required.`;
  return null;
}

export const REQUEST_STATUS_META: Record<VendorRequestStatus, { label: string; tone: StatusTone }> =
  {
    PENDING: { label: "Waiting for you", tone: "warning" },
    APPROVED: { label: "Approved", tone: "success" },
    REJECTED: { label: "Rejected", tone: "critical" },
  };

export const REQUEST_TABS: ReadonlyArray<{ value: VendorRequestStatus | "ALL"; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

import type { StatusTone } from "@/lib/contracts/common";
import type {
  SupportCaseState,
  SupportEmployeeRow,
  SupportRequestStatus,
  SupportRequesterType,
} from "./api/support-contracts";

export const SUPPORT_TEXT_MIN = 5;
export const SUPPORT_SUBJECT_MAX = 160;
export const SUPPORT_MESSAGE_MAX = 2000;

/** Mirrors the server rule (trimmed, 5..max characters); the server remains the authority. */
export function isValidSupportText(value: string, max: number): boolean {
  const length = value.trim().length;
  return length >= SUPPORT_TEXT_MIN && length <= max;
}

export const CASE_STATE_META: Record<SupportCaseState, { label: string; tone: StatusTone }> = {
  PENDING: { label: "In progress", tone: "info" },
  EXCEPTION: { label: "Needs attention", tone: "critical" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const REQUEST_STATUS_META: Record<
  SupportRequestStatus,
  { label: string; tone: StatusTone }
> = {
  OPEN: { label: "Open", tone: "warning" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  RESOLVED: { label: "Resolved", tone: "success" },
};

export const REQUESTER_LABEL: Record<SupportRequesterType, string> = {
  CANDIDATE: "Candidate",
  CLIENT_ADMIN: "Client Admin",
};

export const EMPLOYEE_TABS: ReadonlyArray<{ value: SupportCaseState | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "EXCEPTION", label: "Needs attention" },
  { value: "PENDING", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const REQUEST_TABS: ReadonlyArray<{ value: SupportRequestStatus | "ALL"; label: string }> = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ALL", label: "All" },
];

/** What an agent may do next: take an open request, resolve any unresolved one. */
export function requestActions(status: SupportRequestStatus) {
  return { canStart: status === "OPEN", canResolve: status !== "RESOLVED" };
}

/** "3 uploaded · 2 verified · 1 to re-upload": the employee's document position at a glance. */
export function documentSummary(documents: SupportEmployeeRow["documents"]): string {
  if (!documents.uploaded) return "Nothing uploaded yet";
  const parts = [`${documents.uploaded} uploaded`];
  if (documents.verified) parts.push(`${documents.verified} verified`);
  if (documents.awaitingReview) parts.push(`${documents.awaitingReview} awaiting review`);
  if (documents.needsCorrection) parts.push(`${documents.needsCorrection} to re-upload`);
  return parts.join(" · ");
}

import type { CaseListItem } from "@/lib/api/cases";

export const terminalCaseStatuses = new Set(["COMPLETED", "CLOSED", "CANCELLED"]);

export function caseProgress(item: CaseListItem): number {
  const completed = item.checks.filter((check) => check.status === "COMPLETED").length;
  return item.checks.length ? Math.round((completed / item.checks.length) * 100) : 0;
}

export function caseStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Preparing case",
    CONSENT_PENDING: "Consent required",
    DOCUMENT_PENDING: "Waiting for documents",
    READY: "Ready to start",
    IN_PROGRESS: "Verification in progress",
    CLARIFICATION_PENDING: "Information required",
    QA_PENDING: "Final quality review",
    QA_REVIEW: "Final quality review",
    APPROVED: "Approved",
    COMPLETED: "Verification completed",
    CLOSED: "Case closed",
    CANCELLED: "Case cancelled",
  };
  return labels[value] ?? humanize(value);
}

export function statusTone(value: string): string {
  if (["COMPLETED", "CLOSED", "APPROVED", "RESOLVED"].includes(value)) {
    return "bg-success-soft text-success-foreground ring-success/20";
  }
  if (["CANCELLED", "REJECTED", "OVERDUE"].includes(value)) {
    return "bg-critical-soft text-critical-foreground ring-critical/20";
  }
  if (["CLARIFICATION_PENDING", "OPEN", "DOCUMENT_PENDING"].includes(value)) {
    return "bg-warning-soft text-warning-foreground ring-warning/20";
  }
  if (["RESPONDED", "QA_PENDING", "QA_REVIEW"].includes(value)) {
    return "bg-review-soft text-review-foreground ring-review/20";
  }
  return "bg-info-soft text-info-foreground ring-info/20";
}

export function relativeTime(value: string): string {
  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(Math.abs(difference) / 60_000));
  const suffix = difference >= 0 ? "ago" : "from now";
  if (minutes < 60) return `${minutes}m ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  return `${Math.round(hours / 24)}d ${suffix}`;
}

export function slaText(dueAt: string | null | undefined, status: string): string {
  if (!dueAt) return "SLA not assigned";
  if (terminalCaseStatuses.has(status)) return `Closed ${formatDate(dueAt)}`;
  const difference = new Date(dueAt).getTime() - Date.now();
  const hours = Math.round(Math.abs(difference) / 3_600_000);
  if (difference < 0) return `${Math.max(1, hours)}h overdue`;
  if (hours < 24) return `${Math.max(1, hours)}h remaining`;
  return `${Math.ceil(hours / 24)}d remaining`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

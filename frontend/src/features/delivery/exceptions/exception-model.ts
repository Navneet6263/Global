import type { ExceptionsDashboard } from "@/lib/api/dashboards";

export type ExceptionQueueItem = {
  id: string;
  caseId: string;
  category: "OVERDUE" | "CLARIFICATION" | "FIELD";
  title: string;
  detail: string;
  age: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  status: string;
  version?: number;
};

export function buildExceptionItems(data: ExceptionsDashboard): ExceptionQueueItem[] {
  const now = Date.now();
  return [
    ...data.overdue.map((item): ExceptionQueueItem => ({
      id: item.id,
      caseId: item.id,
      category: "OVERDUE",
      title: item.subject.fullName,
      detail: `${item.caseNumber} · ${item.client.displayName}`,
      age: now - new Date(item.dueAt).getTime(),
      severity: item.priority === "URGENT" ? "CRITICAL" : "HIGH",
      status: item.status,
    })),
    ...data.clarifications.map((item): ExceptionQueueItem => ({
      id: item.id,
      caseId: item.case.publicId,
      category: "CLARIFICATION",
      title: item.subject,
      detail: `${item.case.caseNumber} · ${item.case.subject.fullName}`,
      age: now - new Date(item.createdAt).getTime(),
      severity: item.status === "RESPONDED" ? "MEDIUM" : "HIGH",
      status: item.status,
    })),
    ...data.fieldVisits.map((item): ExceptionQueueItem => ({
      id: item.id,
      caseId: item.case.publicId,
      category: "FIELD",
      title: item.address,
      detail: `${item.case.caseNumber} · ${item.assignee?.displayName ?? "Unassigned"}`,
      age: now - new Date(item.createdAt).getTime(),
      severity: "CRITICAL",
      status: "EXCEPTION_REVIEW",
      version: item.version,
    })),
  ].sort((a, b) => severityValue(b.severity) - severityValue(a.severity) || b.age - a.age);
}

export function severityTone(value: string) {
  return value === "CRITICAL"
    ? "bg-red-100 text-red-700"
    : value === "HIGH"
      ? "bg-amber-100 text-amber-700"
      : "bg-blue-100 text-blue-700";
}

function severityValue(value: string) {
  return value === "CRITICAL" ? 3 : value === "HIGH" ? 2 : 1;
}

export function ageLabel(ms: number) {
  const hours = Math.max(0, Math.round(ms / 3_600_000));
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

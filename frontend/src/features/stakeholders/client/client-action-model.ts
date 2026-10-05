import type { ExceptionsDashboard } from "@/lib/api/dashboards";

export interface ClientActionItem {
  id: string;
  caseId: string;
  candidate: string;
  caseNumber: string;
  title: string;
  detail: string;
  kind: "response" | "documents" | "review" | "overdue";
  dueAt?: string | null;
  updatedAt?: string;
}
export function clientActionItems(data: ExceptionsDashboard): ClientActionItem[] {
  const clarifications: ClientActionItem[] = data.clarifications
    .filter((item) => ["OPEN", "RESPONDED"].includes(item.status))
    .map((item) => ({
      id: `clarification-${item.id}`,
      caseId: item.case.publicId,
      candidate: item.case.subject.fullName,
      caseNumber: item.case.caseNumber,
      title: item.subject,
      detail: item.latestMessage?.body ?? "Open the case to review this request.",
      kind: item.status === "RESPONDED" ? "review" : "response",
      dueAt: item.dueAt,
      updatedAt: item.updatedAt,
    }));
  return [
    ...clarifications,
    ...data.rejectedDocuments.map((item): ClientActionItem => ({
      id: `document-${item.id}`,
      caseId: item.case.publicId,
      candidate: item.case.subject.fullName,
      caseNumber: item.case.caseNumber,
      title: `${item.type.replaceAll("_", " ")} needs replacement`,
      detail: "Open the case to review the reason and provide a corrected document.",
      kind: "documents",
      updatedAt: item.updatedAt,
    })),
    ...data.overdue.map((item): ClientActionItem => ({
      id: `overdue-${item.id}`,
      caseId: item.id,
      candidate: item.subject.fullName,
      caseNumber: item.caseNumber,
      title: "Delivery SLA overdue",
      detail: "The delivery team owns this delay. Open the case to see its current progress.",
      kind: "overdue",
      dueAt: item.dueAt,
    })),
  ];
}
export function filterClientActions(items: ClientActionItem[], kind: string, search: string) {
  const query = search.trim().toLowerCase();
  return items.filter(
    (item) =>
      (!kind || item.kind === kind) &&
      `${item.candidate} ${item.caseNumber} ${item.title}`.toLowerCase().includes(query),
  );
}

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

/** How each kind of item reads to the client, where it opens and how urgent it is. */
export const ACTION_GUIDE = {
  documents: {
    rank: 0,
    label: "Replace a document",
    button: "Upload now",
    tab: "documents",
    yours: true,
  },
  response: {
    rank: 1,
    label: "Answer our question",
    button: "Reply now",
    tab: "requests",
    yours: true,
  },
  overdue: {
    rank: 2,
    label: "Past the promised time",
    button: "Track case",
    tab: "overview",
    yours: false,
  },
  review: {
    rank: 3,
    label: "Your reply is being checked",
    button: "View",
    tab: "requests",
    yours: false,
  },
} as const;

/**
 * Most urgent first: the client's own work (documents, then questions), with anything
 * already past its due date ahead of the rest; then items the Sapling team is handling.
 */
export function rankClientActions(items: ClientActionItem[], now = new Date()) {
  const late = (item: ClientActionItem) =>
    item.dueAt ? new Date(item.dueAt).getTime() < now.getTime() : false;
  const due = (item: ClientActionItem) =>
    item.dueAt ? new Date(item.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => {
    const mine = Number(ACTION_GUIDE[b.kind].yours) - Number(ACTION_GUIDE[a.kind].yours);
    if (mine) return mine;
    const lateFirst = Number(late(b)) - Number(late(a));
    if (lateFirst) return lateFirst;
    const rank = ACTION_GUIDE[a.kind].rank - ACTION_GUIDE[b.kind].rank;
    return rank || due(a) - due(b);
  });
}

export function isLate(item: ClientActionItem, now = new Date()) {
  return item.dueAt ? new Date(item.dueAt).getTime() < now.getTime() : false;
}

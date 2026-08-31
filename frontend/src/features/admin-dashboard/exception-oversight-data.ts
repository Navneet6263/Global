import type { ExceptionsDashboard } from "@/lib/backend-api/dashboards";

export type AdminExceptionCategory = "Overdue" | "Clarification" | "Field";
export type AdminExceptionSeverity = "critical" | "high" | "medium";

export interface AdminExceptionRow {
  id: string;
  category: AdminExceptionCategory;
  severity: AdminExceptionSeverity;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  issue: string;
  owner: string;
  raisedAt: string;
}

export function buildAdminExceptionRows(data: ExceptionsDashboard): AdminExceptionRow[] {
  return [
    ...data.overdue.map((item): AdminExceptionRow => ({
      id: `overdue-${item.id}`,
      category: "Overdue",
      severity: item.priority === "URGENT" ? "critical" : "high",
      caseNumber: item.caseNumber,
      candidateName: item.subject.fullName,
      clientName: item.client.displayName,
      issue: "Case is past its committed due date",
      owner: "Operations",
      raisedAt: item.dueAt,
    })),
    ...data.clarifications.map((item): AdminExceptionRow => ({
      id: `clarification-${item.id}`,
      category: "Clarification",
      severity:
        item.dueAt && Date.parse(item.dueAt) < Date.now()
          ? "high"
          : item.status === "RESPONDED"
            ? "medium"
            : "high",
      caseNumber: item.case.caseNumber,
      candidateName: item.case.subject.fullName,
      clientName: item.case.client.displayName,
      issue: item.subject,
      owner: item.latestMessage?.senderType === "CLIENT" ? "Operations" : "Client",
      raisedAt: item.createdAt,
    })),
    ...data.fieldVisits.map((item): AdminExceptionRow => ({
      id: `field-${item.id}`,
      category: "Field",
      severity: "critical",
      caseNumber: item.case.caseNumber,
      candidateName: item.case.subject.fullName,
      clientName: item.case.client.displayName,
      issue: item.distanceMeters
        ? `${Math.round(item.distanceMeters)} m from target · ${item.address}`
        : `Field visit requires review · ${item.address}`,
      owner: item.assignee?.displayName ?? "Unassigned",
      raisedAt: item.createdAt,
    })),
  ].sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) ||
      Date.parse(a.raisedAt) - Date.parse(b.raisedAt),
  );
}

function severityRank(value: AdminExceptionSeverity) {
  if (value === "critical") return 3;
  if (value === "high") return 2;
  return 1;
}

import type { ExceptionQueue, OpsException, OpsExceptionQuery } from "../contracts/operations";
import { getCase } from "@/lib/backend-api/cases";
import { apiRequest } from "@/lib/backend-api/client";
import { resolveClarification } from "@/lib/backend-api/clarifications";
import { getExceptionsDashboard } from "@/lib/backend-api/dashboards";
import { listAllOperationCases } from "./api-operations-cases";

type IndexedException = {
  caseId: string;
  type: "clarification" | "field" | "sla";
  version?: number;
};
type OwnedCase = {
  id: string;
  version: number;
  assignedOpsUser?: { publicId: string; displayName: string } | null;
};

const exceptionIndex = new Map<string, IndexedException>();

export async function getApiExceptions(query: OpsExceptionQuery): Promise<ExceptionQueue> {
  const [data, cases] = await Promise.all([getExceptionsDashboard(), listAllOperationCases()]);
  exceptionIndex.clear();
  const caseIndex = new Map(
    (cases as unknown as OwnedCase[]).map((item) => [item.id, item] as const),
  );
  const ownerFor = (caseId: string) =>
    caseIndex.get(caseId)?.assignedOpsUser?.displayName ?? "Unassigned";
  const rows: OpsException[] = [
    ...data.overdue.map((row) => {
      exceptionIndex.set(row.id, { caseId: row.id, type: "sla" });
      return {
        id: row.id,
        type: "sla_overdue" as const,
        severity: row.priority === "URGENT" ? ("critical" as const) : ("high" as const),
        caseId: row.id,
        caseNumber: row.caseNumber,
        candidateName: row.subject.fullName,
        clientName: row.client.displayName,
        reason: "Case is past its committed due date",
        raisedAt: row.dueAt,
        ageMinutes: age(row.dueAt),
        slaImpact: "SLA breached",
        owner: ownerFor(row.id),
        latestUpdate: row.createdAt,
        recommendedAction: "Review and escalate",
        status: "open" as const,
        resolutionNote: null,
      };
    }),
    ...data.clarifications.map((row) => {
      exceptionIndex.set(row.id, { caseId: row.case.publicId, type: "clarification" });
      return {
        id: row.id,
        type: "client_clarification" as const,
        severity:
          row.dueAt && Date.parse(row.dueAt) < Date.now() ? ("high" as const) : ("medium" as const),
        caseId: row.case.publicId,
        caseNumber: row.case.caseNumber,
        candidateName: row.case.subject.fullName,
        clientName: row.case.client.displayName,
        reason: row.subject,
        raisedAt: row.createdAt,
        ageMinutes: age(row.createdAt),
        slaImpact: "Awaiting response",
        owner: ownerFor(row.case.publicId),
        latestUpdate: row.latestMessage?.body ?? row.subject,
        recommendedAction: "Review clarification",
        status: row.status === "RESOLVED" ? ("resolved" as const) : ("open" as const),
        resolutionNote: null,
      };
    }),
    ...data.fieldVisits.map((row) => {
      exceptionIndex.set(row.id, {
        caseId: row.case.publicId,
        type: "field",
        version: row.version,
      });
      return {
        id: row.id,
        type: "field_visit" as const,
        severity: "high" as const,
        caseId: row.case.publicId,
        caseNumber: row.case.caseNumber,
        candidateName: row.case.subject.fullName,
        clientName: row.case.client.displayName,
        reason: `Field exception at ${row.address}`,
        raisedAt: row.createdAt,
        ageMinutes: age(row.createdAt),
        slaImpact: "Visit blocked",
        owner: ownerFor(row.case.publicId),
        latestUpdate: row.capturedAt ?? row.createdAt,
        recommendedAction: "Review field evidence",
        status: "open" as const,
        resolutionNote: null,
      };
    }),
  ];
  const filtered = filterRows(rows, query);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    openCount: rows.filter((row) => row.status === "open").length,
    resolvedCount: data.summary.resolvedToday,
  };
}

export async function resolveApiException(id: string, note: string) {
  const item = requireIndexed(id);
  if (item.type === "clarification") {
    await resolveClarification(item.caseId, id, note);
    return;
  }
  if (item.type === "field") {
    await apiRequest(`/field-visits/${id}/exception`, {
      method: "PATCH",
      body: JSON.stringify({ decision: "APPROVE", version: item.version, note }),
    });
    return;
  }
  throw new Error("An SLA exception closes only after its due date or case status is corrected");
}

export async function escalateApiException(id: string, note: string) {
  const item = requireIndexed(id);
  const detail = await getCase(item.caseId);
  await apiRequest(`/cases/${item.caseId}/escalation`, {
    method: "PATCH",
    body: JSON.stringify({ version: detail.version, note }),
  });
}

export async function assignApiExceptionOwner(id: string, ownerId: string) {
  const item = requireIndexed(id);
  const detail = await getCase(item.caseId);
  await apiRequest(`/cases/${item.caseId}/owner`, {
    method: "PATCH",
    body: JSON.stringify({
      version: detail.version,
      ownerId,
      note: "Assigned from the operations exception queue",
    }),
  });
}

function requireIndexed(id: string) {
  const item = exceptionIndex.get(id);
  if (!item) throw new Error("Refresh the exception queue and try again");
  return item;
}

function age(value: string) {
  return Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
}

function filterRows(rows: OpsException[], query: OpsExceptionQuery) {
  return rows.filter((row) => {
    if (row.status !== (query.status ?? "open")) return false;
    if (query.type && query.type !== "all" && row.type !== query.type) return false;
    if (query.severity && query.severity !== "all" && row.severity !== query.severity) return false;
    if (query.owner && row.owner !== query.owner) return false;
    if (query.search) {
      const haystack = `${row.caseNumber} ${row.candidateName} ${row.clientName}`.toLowerCase();
      if (!haystack.includes(query.search.toLowerCase())) return false;
    }
    if (query.ageBucket === "under_24h" && row.ageMinutes >= 1_440) return false;
    if (query.ageBucket === "1_3d" && (row.ageMinutes < 1_440 || row.ageMinutes >= 4_320)) {
      return false;
    }
    if (query.ageBucket === "over_3d" && row.ageMinutes < 4_320) return false;
    return true;
  });
}

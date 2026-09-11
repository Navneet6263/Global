import type { CaseRepository } from "../repositories";
import { casePackageName } from "@/lib/backend-api/case-services";
import type { CaseDetail, CaseListItem } from "@/lib/backend-api/cases";
import { getCase, listAllClients, listCases } from "@/lib/backend-api/cases";
import { checkLabel, normalizeCheckType as checkType } from "@/lib/contracts/check";
import type {
  CasePriority,
  CaseStage,
  CheckStatus,
  SlaState,
  VerificationCase,
} from "@/lib/contracts/case";

const caseStatus: Record<string, CaseStage> = {
  DRAFT: "intake",
  CONSENT_PENDING: "consent",
  DOCUMENT_PENDING: "documents",
  IN_PROGRESS: "verification",
  CLARIFICATION_PENDING: "clarification",
  QA_REVIEW: "qa",
  MANAGER_REVIEW: "manager_review",
  REPORT_PENDING: "report_pending",
  PAYMENT_PENDING: "payment_pending",
  COMPLETED: "completed",
  CLOSED: "completed",
  CANCELLED: "completed",
};

const stageProgress: Record<CaseStage, number> = {
  intake: 8,
  consent: 18,
  documents: 32,
  verification: 62,
  clarification: 68,
  qa: 88,
  manager_review: 91,
  report_pending: 94,
  payment_pending: 97,
  completed: 100,
};

const priorityQuery: Record<CasePriority, string> = {
  standard: "NORMAL",
  high: "HIGH",
  critical: "URGENT",
};

function checkStatus(value: string): CheckStatus {
  const statuses: Record<string, CheckStatus> = {
    PENDING: "not_started",
    OPEN: "in_progress",
    UNASSIGNED: "not_started",
    IN_PROGRESS: "in_progress",
    BLOCKED: "awaiting_input",
    COMPLETED: "verified",
    DISCREPANCY: "discrepancy",
    UNABLE_TO_VERIFY: "unable_to_verify",
  };
  return statuses[value] ?? "not_started";
}

function priority(value: string): CasePriority {
  if (value === "URGENT") return "critical";
  if (value === "HIGH") return "high";
  return "standard";
}

function sla(dueAt?: string | null): { minutes: number; state: SlaState } {
  if (!dueAt) return { minutes: 0, state: "healthy" };
  const minutes = Math.round((Date.parse(dueAt) - Date.now()) / 60_000);
  return {
    minutes,
    state: minutes < 0 ? "overdue" : minutes <= 480 ? "approaching" : "healthy",
  };
}

export function mapCase(row: CaseListItem | CaseDetail): VerificationCase {
  const stage = caseStatus[row.status] ?? "verification";
  const due = sla(row.dueAt);
  const detail = row as CaseDetail;
  return {
    id: row.id,
    caseNumber: row.caseNumber,
    candidateName: row.subject.fullName,
    candidateEmail: row.subject.email ?? "",
    candidateMobile: row.subject.phone ?? "",
    clientId: row.client.publicId,
    clientName: row.client.displayName,
    packageName: casePackageName(row),
    checkBundle: row.checks.map((check) => checkType(check.type)),
    stage,
    progress: stageProgress[stage],
    priority: priority(row.priority),
    slaMinutesRemaining: due.minutes,
    slaState: due.state,
    owner: row.assignedOpsUser?.displayName ?? null,
    branch: row.branch?.name ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    checks: row.checks.map((check) => ({
      id: check.publicId,
      type: checkType(check.type),
      label: checkLabel(check.type),
      status: checkStatus(
        check.status === "COMPLETED" &&
          ["DISCREPANCY", "UNABLE_TO_VERIFY"].includes(check.result ?? "")
          ? check.result!
          : check.status,
      ),
      assignee: check.tasks?.find((task) => task.assignee)?.assignee?.displayName ?? "Unassigned",
      updatedAt: check.completedAt ?? row.updatedAt,
      note: check.sourceSummary ?? undefined,
    })),
    documents: (detail.documents ?? []).map((document) => ({
      id: document.publicId,
      label: document.type.replaceAll("_", " "),
      status:
        document.status === "VERIFIED"
          ? "verified"
          : ["REJECTED", "REUPLOAD_REQUIRED"].includes(document.status)
            ? "rejected"
            : document.currentVersion > 0
              ? "received"
              : "pending",
      updatedAt: document.versions.at(0)?.createdAt ?? row.updatedAt,
      rejectionReason: document.reviewNote ?? undefined,
      originalName: document.versions[0]?.originalName,
      available: Boolean(document.currentVersion > 0 && document.versions[0]),
    })),
    clarifications: (detail.clarifications ?? []).map((item) => ({
      id: item.publicId,
      question: item.subject,
      status:
        item.status === "RESOLVED" ? "closed" : item.status === "ANSWERED" ? "answered" : "open",
      raisedAt: item.createdAt,
      dueAt: item.dueAt ?? null,
    })),
    timeline: (detail.statusHistory ?? []).map((event, index) => ({
      id: `${row.id}-${index}`,
      label: event.toStatus.replaceAll("_", " "),
      detail: event.reason ?? "Workflow status updated",
      at: event.createdAt,
      stage: caseStatus[event.toStatus] ?? "verification",
    })),
    assignments: [],
    reports: (detail.reports ?? []).map((report) => ({
      id: report.publicId,
      version: `v${report.currentVersion}`,
      status: report.status,
      publishedAt: report.publishedAt ?? null,
      createdAt: report.createdAt,
    })),
  };
}

export const caseRepository: CaseRepository = {
  async list(query) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const result = await listCases({
      search: query.search,
      stage: query.stage === "all" ? undefined : query.stage,
      clientId: query.clientId === "all" ? undefined : query.clientId,
      priority:
        query.priority && query.priority !== "all" ? priorityQuery[query.priority] : undefined,
      sla: query.sla === "all" ? undefined : query.sla,
      from: query.from,
      to: query.to,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      page,
      pageSize,
      limit: pageSize,
    });
    return {
      rows: result.items.map(mapCase),
      total: result.total,
      page: result.page ?? page,
      pageSize: result.pageSize ?? pageSize,
    };
  },
  async getById(id) {
    try {
      return mapCase(await getCase(id));
    } catch {
      return null;
    }
  },
  async facets() {
    const clients = await listAllClients();
    return {
      clients: clients.map((client) => ({
        value: client.publicId,
        label: client.displayName,
      })),
    };
  },
};

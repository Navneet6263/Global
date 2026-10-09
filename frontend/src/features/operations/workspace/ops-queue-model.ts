import type { CaseDetail, CaseListItem, CaseListQueryInput } from "@/lib/backend-api/cases";

/** Attention shortcuts above the Operations work queue. Each maps to a server filter. */
export const opsQueueViews = [
  { value: "needs-rm", label: "Needs RM" },
  { value: "documents", label: "Awaiting documents" },
  { value: "overdue", label: "Overdue" },
  { value: "escalated", label: "Escalated" },
  { value: "queries", label: "Corrections & queries" },
  { value: "qc", label: "In QC" },
  { value: "stopped", label: "Stopped" },
  { value: "completed", label: "Completed" },
] as const;
export type OpsQueueView = (typeof opsQueueViews)[number]["value"];

export const opsStageFilters = [
  { value: "consent", label: "Consent" },
  { value: "documents", label: "Documents" },
  { value: "clarification", label: "Corrections & queries" },
  { value: "verification", label: "Verification" },
  { value: "qa", label: "QC review" },
  { value: "manager_review", label: "RM approval" },
  { value: "report_pending", label: "Report preparation" },
  { value: "payment_pending", label: "Payment & release" },
] as const;
export type OpsStageFilter = (typeof opsStageFilters)[number]["value"];

export interface OpsQueueSearch {
  caseId?: string;
  q?: string;
  view?: OpsQueueView;
  stage?: OpsStageFilter;
  clientId?: string;
  ownerId?: string;
  page?: number;
  pageSize?: number;
}

export const OPS_PAGE_SIZE = 6;
const ID = /^[A-Za-z0-9-]{1,64}$/;

export function parseOpsQueueSearch(input: Record<string, unknown>): OpsQueueSearch {
  const page =
    typeof input["page"] === "string" || typeof input["page"] === "number"
      ? Number(input["page"])
      : 1;
  const q = typeof input["q"] === "string" ? input["q"].trim().slice(0, 120) : "";
  const id = (key: string) =>
    typeof input[key] === "string" && ID.test(input[key]) ? input[key] : undefined;
  return {
    caseId: id("caseId"),
    q: q || undefined,
    view: opsQueueViews.some((item) => item.value === input["view"])
      ? (input["view"] as OpsQueueView)
      : undefined,
    stage: opsStageFilters.some((item) => item.value === input["stage"])
      ? (input["stage"] as OpsStageFilter)
      : undefined,
    clientId: id("clientId"),
    ownerId: id("ownerId"),
    page: Number.isSafeInteger(page) && page > 1 && page <= 100_000 ? page : undefined,
    pageSize: input["pageSize"] === 12 || input["pageSize"] === "12" ? 12 : undefined,
  };
}

/** Server query for the queue. Tenant, branch and client scope always come from the session. */
export function opsQueueQuery(search: OpsQueueSearch): CaseListQueryInput {
  const pageSize = search.pageSize ?? OPS_PAGE_SIZE;
  const view = search.view;
  const status =
    view === "documents"
      ? "DOCUMENT_PENDING"
      : view === "queries"
        ? "CLARIFICATION_PENDING"
        : view === "qc"
          ? "QA_REVIEW"
          : undefined;
  return {
    view: "active",
    search: search.q,
    clientId: search.clientId,
    ownerId: view === "needs-rm" ? undefined : search.ownerId,
    unassigned: view === "needs-rm" ? true : undefined,
    escalated: view === "escalated" ? true : undefined,
    sla: view === "overdue" ? "overdue" : undefined,
    status,
    stage: status
      ? undefined
      : view === "completed"
        ? "completed"
        : view === "stopped"
          ? "stopped"
          : search.stage,
    page: search.page ?? 1,
    pageSize,
    limit: pageSize,
    sortBy: "sla",
    sortDir: "asc",
  };
}

export const pipelineSteps = [
  "Intake",
  "Documents",
  "Verification",
  "QC",
  "RM approval",
  "Report release",
] as const;

type Tone = "info" | "warning" | "review" | "success" | "neutral" | "critical";
interface StageMeta {
  label: string;
  step: number;
  tone: Tone;
  with: string;
  next: string;
}

const stageMeta: Record<string, StageMeta> = {
  DRAFT: {
    label: "Draft",
    step: 0,
    tone: "neutral",
    with: "Client",
    next: "Client completes the case and sends the candidate link.",
  },
  CONSENT_PENDING: {
    label: "Consent",
    step: 0,
    tone: "info",
    with: "Candidate",
    next: "Candidate gives consent through the secure link.",
  },
  DOCUMENT_PENDING: {
    label: "Documents",
    step: 1,
    tone: "warning",
    with: "Candidate",
    next: "Candidate submits documents. Data Entry checks them; Ready returns to the RM.",
  },
  CLARIFICATION_PENDING: {
    label: "Correction",
    step: 1,
    tone: "warning",
    with: "Candidate / client",
    next: "Requester responds. Data Entry reviews; Ready returns to the RM.",
  },
  IN_PROGRESS: {
    label: "Verification",
    step: 2,
    tone: "info",
    with: "Verification team",
    next: "Assigned teams complete their checks, then QC reviews the evidence.",
  },
  QA_REVIEW: {
    label: "QC review",
    step: 3,
    tone: "review",
    with: "QC",
    next: "QC approves or returns the work for rework. Approval returns to the RM.",
  },
  MANAGER_REVIEW: {
    label: "RM approval",
    step: 4,
    tone: "review",
    with: "RM",
    next: "The responsible RM performs the final review and approval.",
  },
  REPORT_PENDING: {
    label: "Report preparation",
    step: 5,
    tone: "info",
    with: "Report team",
    next: "Final report is prepared. Release stays subject to payment rules.",
  },
  PAYMENT_PENDING: {
    label: "Payment & release",
    step: 5,
    tone: "warning",
    with: "Finance",
    next: "Finance confirms eligibility before the report is released to the client.",
  },
  COMPLETED: {
    label: "Completed",
    step: 6,
    tone: "success",
    with: "—",
    next: "Released. No further action.",
  },
  CLOSED: { label: "Closed", step: 6, tone: "neutral", with: "—", next: "Case closed." },
  CANCELLED: { label: "Cancelled", step: 6, tone: "critical", with: "—", next: "Case cancelled." },
  STOPPED: {
    label: "Stopped",
    step: 0,
    tone: "critical",
    with: "On hold",
    next: "Stopped on client instruction. Resume when the client confirms.",
  },
};

export function opsStage(status: string): StageMeta {
  return (
    stageMeta[status] ?? {
      label: status.toLowerCase().replaceAll("_", " "),
      step: 0,
      tone: "neutral",
      with: "Operations",
      next: "Review the case.",
    }
  );
}

type FlowCase = Pick<CaseListItem, "status" | "workflow">;

const intakeMeta: Record<string, StageMeta> = {
  INTAKE: {
    label: "Awaiting Data Entry",
    step: 1,
    tone: "warning",
    with: "RM",
    next: "The RM assigns a Data Entry user to check completeness.",
  },
  DATA_ENTRY: {
    label: "Data Entry",
    step: 1,
    tone: "info",
    with: "Data Entry",
    next: "Data Entry checks documents. Ready returns the case to the RM.",
  },
  CORRECTION: {
    label: "Correction (L1)",
    step: 1,
    tone: "warning",
    with: "Candidate / client",
    next: "Candidate or client responds; Data Entry rechecks and marks Ready.",
  },
  READY: {
    label: "Ready to route",
    step: 1,
    tone: "warning",
    with: "RM",
    next: "The RM routes each check to its department; Team Leaders assign members.",
  },
};

/** Stage including the v2 intake steps (RM -> Data Entry -> Ready) before verification. */
export function caseStage(item: FlowCase): StageMeta {
  const intake = item.workflow?.version === 2 ? item.workflow.intakeStage : null;
  if (intake && item.status === "DOCUMENT_PENDING" && intakeMeta[intake])
    return intakeMeta[intake]!;
  if (item.workflow?.version === 2 && item.status === "IN_PROGRESS")
    return {
      ...opsStage(item.status),
      next: "Team Leaders assign members; verifiers complete checks, then QC reviews.",
    };
  return opsStage(item.status);
}

/** Who is currently doing the work. Uses only names the API returned. */
export function workingWith(
  item: Pick<CaseListItem, "status" | "checks" | "assignedOpsUser" | "workflow">,
) {
  const meta = caseStage(item);
  const intake =
    item.workflow?.version === 2 && item.status === "DOCUMENT_PENDING"
      ? item.workflow.intakeStage
      : null;
  if (intake === "DATA_ENTRY")
    return { name: item.workflow?.dataEntryUser?.displayName ?? "Data Entry", role: "Data Entry" };
  if ((intake === "INTAKE" || intake === "READY") && item.assignedOpsUser)
    return { name: item.assignedOpsUser.displayName, role: meta.label };
  if (item.status === "IN_PROGRESS") {
    const names = [
      ...new Set(
        item.checks.flatMap((check) =>
          (check.tasks ?? [])
            .filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status))
            .flatMap((task) => (task.assignee ? [task.assignee.displayName] : [])),
        ),
      ),
    ];
    if (names.length === 1) return { name: names[0]!, role: "Verifier" };
    if (names.length > 1) return { name: `${names.length} verifiers`, role: "Verification" };
    const teams = [
      ...new Set(item.checks.flatMap((check) => (check.department ? [check.department.name] : []))),
    ];
    if (teams.length) return { name: `${teams.join(", ")} team`, role: "Awaiting Team Leader" };
    return { name: "Unassigned checks", role: "Awaiting allocation" };
  }
  if (item.status === "MANAGER_REVIEW" && item.assignedOpsUser) {
    return { name: item.assignedOpsUser.displayName, role: "RM" };
  }
  return { name: meta.with, role: meta.label };
}

export function dueState(dueAt: string | null | undefined, now = Date.now()) {
  if (!dueAt || !Number.isFinite(Date.parse(dueAt))) return { text: "No due date", tone: "muted" };
  const minutes = Math.round((Date.parse(dueAt) - now) / 60_000);
  const span = (value: number) =>
    value >= 1440
      ? `${Math.floor(value / 1440)}d`
      : value >= 60
        ? `${Math.floor(value / 60)}h`
        : `${Math.max(1, value)}m`;
  if (minutes < 0) return { text: `Overdue ${span(-minutes)}`, tone: "critical" };
  return { text: `${span(minutes)} left`, tone: minutes <= 8 * 60 ? "warning" : "muted" };
}

export interface PendingReason {
  title: string;
  detail?: string;
}

/** Why the case is waiting, from documents, requests and due date recorded on the case. */
export function pendingReasons(item: CaseDetail, now = Date.now()): PendingReason[] {
  const reasons: PendingReason[] = [];
  for (const document of item.documents.filter((entry) => entry.status === "REJECTED")) {
    reasons.push({
      title: `${humanizeCode(document.type)} needs replacement`,
      detail: document.reviewNote ?? undefined,
    });
  }
  for (const request of item.clarifications.filter((entry) =>
    ["OPEN", "RESPONDED"].includes(entry.status),
  )) {
    reasons.push({
      title: request.status === "RESPONDED" ? "Response awaiting review" : "Information requested",
      detail: request.subject,
    });
  }
  const intake =
    item.workflow?.version === 2 && item.status === "DOCUMENT_PENDING"
      ? item.workflow.intakeStage
      : null;
  if (intake === "INTAKE" && item.assignedOpsUser)
    reasons.push({ title: "Waiting for the RM to assign Data Entry" });
  if (intake === "READY") reasons.push({ title: "Ready — waiting for the RM to route checks" });
  if (item.status === "CONSENT_PENDING") reasons.push({ title: "Candidate consent pending" });
  if (item.status === "DOCUMENT_PENDING" && !reasons.length)
    reasons.push({ title: "Candidate documents pending" });
  if (item.status === "IN_PROGRESS") {
    const unassigned = item.checks.filter(
      (check) =>
        check.status !== "COMPLETED" &&
        !(check.tasks ?? []).some(
          (task) => task.assignee && !["COMPLETED", "CANCELLED"].includes(task.status),
        ),
    ).length;
    if (unassigned)
      reasons.push({
        title: `${unassigned} check${unassigned === 1 ? "" : "s"} ${
          item.workflow?.version === 2 ? "waiting for a Team Leader to assign" : "not yet assigned"
        }`,
      });
  }
  if (!item.assignedOpsUser && !["COMPLETED", "CLOSED", "CANCELLED"].includes(item.status))
    reasons.unshift({ title: "No responsible RM assigned" });
  const due = dueState(item.dueAt, now);
  if (due.tone === "critical" && !["COMPLETED", "CLOSED", "CANCELLED"].includes(item.status))
    reasons.push({ title: `${due.text} beyond the due time` });
  return reasons;
}

/** When the case entered its current status, from the recorded status history. */
export function pendingSince(item: Pick<CaseDetail, "status" | "statusHistory" | "createdAt">) {
  const entries = item.statusHistory
    .filter((entry) => entry.toStatus === item.status)
    .map((entry) => entry.createdAt)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return entries[0] ?? item.createdAt;
}

export function humanizeCode(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function istDateTime(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  return (
    new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(value)) + " IST"
  );
}

export function istTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

/** RMs who may own a case: active SPOC-RM users mapped to the case's client. */
export function eligibleRms<
  T extends {
    id: string;
    status: string;
    roles: Array<{ code: string }>;
    spocClients?: Array<{ id: string }>;
  },
>(users: readonly T[], clientId: string) {
  return users.filter(
    (user) =>
      user.status === "ACTIVE" &&
      user.roles.some((role) => role.code === "SPOC_RM") &&
      (user.spocClients ?? []).some((client) => client.id === clientId),
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

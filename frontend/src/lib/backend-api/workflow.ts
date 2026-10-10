import { apiDownload, apiRequest, saveBlob } from "./client";

/** v2 internal flow: RM -> Data Entry -> Ready -> RM routing -> Team Leader -> member. */
export type IntakeStage =
  "INTAKE" | "CLIENT_REVIEW" | "CLIENT_RETURNED" | "DATA_ENTRY" | "CORRECTION" | "READY" | "ROUTED";

export interface DepartmentMember {
  id: string;
  displayName: string;
  email: string;
  status: string;
  role: "LEAD" | "MEMBER";
  openWork: number;
}

export type TeamType = "EMPLOYMENT" | "EDUCATION" | "VENDOR" | "DIGITAL";

/** The four verification team types and what each one does. */
export const TEAM_TYPES: ReadonlyArray<{ value: TeamType; label: string; hint: string }> = [
  { value: "EMPLOYMENT", label: "Employment", hint: "HR email, portals, UAN and verbal checks" },
  { value: "EDUCATION", label: "Education", hint: "University / board email, portals and letters" },
  {
    value: "DIGITAL",
    label: "Digital",
    hint: "Online portals and APIs: ID, address, database, court",
  },
  { value: "VENDOR", label: "Vendor", hint: "Sends field and physical work to vendors" },
];

export interface Department {
  id: string;
  code: string;
  name: string;
  kind: "DATA_ENTRY" | "VERIFICATION";
  /** Verification teams: which process the verifier sees. */
  teamType?: TeamType | null;
  status: "ACTIVE" | "INACTIVE";
  version: number;
  checkTypes: string[];
  waitingForAssignment: number;
  members: DepartmentMember[];
}

export interface QueueCase {
  id: string;
  caseNumber: string;
  status: string;
  priority: string;
  version: number;
  workflowVersion: number;
  intakeStage: IntakeStage | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  dataEntryAssignedAt: string | null;
  dataEntryReadyAt: string | null;
  candidateName: string;
  client: { id: string; name: string };
  /** Set when the client or Platform Admin escalated the case. */
  escalation?: { at: string; note: string | null } | null;
  rm: { id: string; name: string } | null;
  dataEntry: { id: string; name: string } | null;
  documents: { total: number; rejected: number };
  openInsufficiency: { l1: number; l2: number };
  checks: { total: number; completed: number; unassigned: number; departments: string[] };
}

export interface CaseQueue {
  items: QueueCase[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  generatedAt: string;
  /** RM overview only: headline numbers and a per-company pulse. */
  summary?: RmSummary;
}

export interface RmSummary {
  active: number;
  overdue: number;
  dueToday: number;
  completedThisWeek: number;
  escalated: number;
  clients: Array<{ id: string; name: string; active: number; overdue: number }>;
}

export const rmBuckets = [
  { value: "needs_data_entry", label: "Assign Data Entry", tone: "action" },
  { value: "with_data_entry", label: "With Data Entry", tone: "progress" },
  { value: "correction", label: "Correction (L1)", tone: "waiting" },
  { value: "ready", label: "Ready to route", tone: "action" },
  { value: "in_verification", label: "In verification", tone: "progress" },
  { value: "qc", label: "In QC", tone: "review" },
  { value: "final_approval", label: "Final approval", tone: "action" },
] as const;
export type RmBucket = (typeof rmBuckets)[number]["value"];

export interface RoutingPlan {
  id: string;
  caseNumber: string;
  version: number;
  status: string;
  intakeStage: IntakeStage | null;
  canRoute: boolean;
  departments: Array<{
    id: string;
    name: string;
    checkTypes: string[];
    leads: string[];
    members: number;
  }>;
  checks: Array<{
    id: string;
    type: string;
    status: string;
    department: { id: string; name: string } | null;
    suggestedDepartmentId: string | null;
  }>;
}

export interface TeamTask {
  id: string;
  status: string;
  version: number;
  blockerReason: string | null;
  createdAt: string;
  dueAt: string | null;
  assignee: { id: string; name: string } | null;
  /** Finished work waiting for the Team Leader (check status TL_REVIEW). */
  review: {
    result: string | null;
    disposition: string | null;
    sourceSummary: string | null;
    riskLevel: string | null;
    findings: Array<{ title: string; severity: string; kind: string }>;
    completedAt: string | null;
  } | null;
  check: {
    id: string;
    type: string;
    status: string;
    routedAt: string | null;
    department: { id: string; name: string } | null;
  };
  case: {
    id: string;
    caseNumber: string;
    status: string;
    priority: string;
    candidateName: string;
    clientName: string;
    rmName: string | null;
  };
}

export interface TeamQueue {
  items: TeamTask[];
  total: number;
  page: number;
  pageSize: number;
  counts: {
    unassigned: number;
    blocked: number;
    overdue: number;
    total: number;
    /** Finished checks waiting for the Team Leader's review. */
    review?: number;
  };
  members: Array<{
    id: string;
    name: string;
    role: "LEAD" | "MEMBER";
    department: { id: string; name: string };
    openWork: number;
  }>;
  generatedAt: string;
}

export interface FinalReviewOverview {
  caseStatus: string;
  caseVersion: number;
  latestQa: {
    id: string;
    decision: string;
    notes: string | null;
    reviewerName: string;
    createdAt: string;
  } | null;
  reviews: Array<{
    id: string;
    decision: string;
    notes: string | null;
    reviewerName?: string;
    createdAt: string;
  }>;
}

function query(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input))
    if (value !== undefined && value !== "") params.set(key, String(value));
  const text = params.toString();
  return text ? `?${text}` : "";
}

const post = <T>(path: string, body: unknown) =>
  apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });

export const listDepartments = () => apiRequest<{ items: Department[] }>("/workflow/departments");

export const createDepartment = (input: {
  code: string;
  name: string;
  kind: Department["kind"];
  teamType?: TeamType;
  checkTypes?: string[];
}) => post<{ id: string }>("/workflow/departments", input);

export const updateDepartment = (
  id: string,
  input: {
    version: number;
    name?: string;
    status?: Department["status"];
    checkTypes?: string[];
    teamType?: TeamType;
  },
) =>
  apiRequest<{ id: string; version: number }>(`/workflow/departments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const setDepartmentMember = (
  id: string,
  input: { userId: string; role: "LEAD" | "MEMBER" },
) => post<{ userId: string; role: string }>(`/workflow/departments/${id}/members`, input);

export const removeDepartmentMember = (id: string, userId: string) =>
  apiRequest<{ removed: true }>(`/workflow/departments/${id}/members/${userId}`, {
    method: "DELETE",
  });

export const getRmQueue = (
  input: {
    bucket?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    clientId?: string;
    sort?: "due" | "newest";
    flag?: "escalated" | "overdue";
  },
  signal?: AbortSignal,
) => apiRequest<CaseQueue>(`/workflow/rm/queue${query(input)}`, { signal });

export const getDataEntryQueue = (
  input: { view?: string; search?: string; page?: number; pageSize?: number },
  signal?: AbortSignal,
) => apiRequest<CaseQueue>(`/workflow/data-entry/queue${query(input)}`, { signal });

export const getTeamQueue = (
  input: {
    view?: string;
    departmentId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
) => apiRequest<TeamQueue>(`/workflow/team/queue${query(input)}`, { signal });

export const assignDataEntry = (
  caseId: string,
  input: { assigneeId: string; version: number; note?: string },
) =>
  post<{ intakeStage: IntakeStage; version: number }>(
    `/workflow/cases/${caseId}/data-entry`,
    input,
  );

export const markCaseReady = (caseId: string, input: { version: number; note?: string }) =>
  post<{ intakeStage: IntakeStage; version: number }>(`/workflow/cases/${caseId}/ready`, input);

export const sendBackToDataEntry = (caseId: string, input: { version: number; reason: string }) =>
  post<{ intakeStage: IntakeStage; version: number }>(`/workflow/cases/${caseId}/send-back`, input);

export const getRoutingPlan = (caseId: string) =>
  apiRequest<RoutingPlan>(`/workflow/cases/${caseId}/routing`);

export const routeChecks = (
  caseId: string,
  input: {
    version: number;
    routes: Array<{ checkId: string; departmentId: string }>;
    note?: string;
  },
) => post<{ status: string; version: number }>(`/workflow/cases/${caseId}/routing`, input);

export const assignTeamTask = (
  taskId: string,
  input: { assigneeId: string; version: number; note?: string },
) => post<{ status: string; version: number }>(`/workflow/tasks/${taskId}/assignee`, input);

export const getFinalReview = (caseId: string) =>
  apiRequest<FinalReviewOverview>(`/workflow/cases/${caseId}/final-review`);

export const decideFinalReview = (
  caseId: string,
  input: {
    caseVersion: number;
    decision: "APPROVED" | "REWORK";
    notes: string;
    recommendation?: string;
    highRiskAcknowledged?: boolean;
  },
) => post<{ caseStatus?: string }>(`/workflow/cases/${caseId}/final-review`, input);

export interface ClientRmRow {
  id: string;
  code: string;
  name: string;
  version: number;
  primaryRm: { id: string; name: string; active: boolean } | null;
  primaryRmAssignedAt: string | null;
  mappedRms: Array<{ id: string; name: string }>;
  openCases: number;
  casesWithoutRm: number;
  /** Route A and the auto Data Entry rule. */
  intakeRules?: {
    clientReviewFirst: boolean;
    defaultDataEntry: { id: string; name: string; active: boolean } | null;
  };
}

export const setIntakeRules = (
  clientId: string,
  input: { version: number; defaultDataEntryUserId?: string | null; clientReviewFirst?: boolean },
) =>
  apiRequest<{ id: string; version: number }>(`/workflow/clients/${clientId}/intake-rules`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

/** Check-wise initiation forms (BGV process): one per check type that needs details. */
export interface InitiationField {
  key: string;
  label: string;
  required?: boolean;
  kind?: "text" | "long" | "select" | "email" | "phone" | "pincode" | "year" | "date" | "time";
  options?: readonly string[];
  /** Section heading; fields without one join the previous section. */
  group?: string;
}
export interface InitiationForm {
  repeatable: boolean;
  fields: InitiationField[];
}

export const getInitiationForms = () =>
  apiRequest<{ forms: Record<string, InitiationForm> }>("/workflow/initiation-forms");

export const initiateCheck = (
  caseId: string,
  checkId: string,
  entries: Array<Record<string, string>>,
) =>
  apiRequest<{ id: string; initiatedAt: string; entries: Array<Record<string, string>> }>(
    `/workflow/cases/${caseId}/checks/${checkId}/initiation`,
    { method: "PUT", body: JSON.stringify({ entries }) },
  );

export const listClientRms = (
  input: { view?: string; search?: string; page?: number; pageSize?: number },
  signal?: AbortSignal,
) =>
  apiRequest<{
    items: ClientRmRow[];
    total: number;
    page: number;
    pageSize: number;
    counts: { withoutRm: number };
  }>(`/workflow/clients${query(input)}`, { signal });

export const assignClientRm = (
  clientId: string,
  input: {
    rmUserId: string;
    version: number;
    apply: "NONE" | "UNASSIGNED" | "ALL_OPEN";
    note?: string;
  },
) => post<{ casesMoved: number; version: number }>(`/workflow/clients/${clientId}/rm`, input);

export const clearClientRm = (clientId: string, version: number) =>
  post<{ version: number }>(`/workflow/clients/${clientId}/rm/clear`, { version });

export const stopCase = (caseId: string, input: { version: number; reason: string }) =>
  post<{ status: string; version: number }>(`/workflow/cases/${caseId}/stop`, input);

export const resumeCase = (caseId: string, input: { version: number; note?: string }) =>
  post<{ status: string; version: number }>(`/workflow/cases/${caseId}/resume`, input);

/** Data Entry dashboard: what is waiting, what was marked Ready, turnaround, L1s. */
export interface DataEntryOverview {
  scope: "mine" | "team";
  canSeeTeam: boolean;
  kpis: {
    inQueue: number;
    corrections: number;
    overdue: number;
    readyToday: number;
    readyThisWeek: number;
    readyThisMonth: number;
    averageTurnaroundHours: number | null;
    l1Raised30d: number;
  };
  trend: Array<{ day: string; ready: number }>;
  pendingByClient: Array<{ client: string; count: number }>;
  recent: Array<{
    caseId: string;
    caseNumber: string;
    candidateName: string;
    clientName: string;
    dataEntry: string | null;
    readyAt: string;
    turnaroundHours: number | null;
  }>;
  team: Array<{ name: string; inQueue: number; readyThisWeek: number }>;
  generatedAt: string;
}

export const DATA_ENTRY_REPORT_COLUMNS = [
  { key: "caseNumber", label: "Sapling ID" },
  { key: "candidate", label: "Candidate" },
  { key: "client", label: "Company" },
  { key: "dataEntry", label: "Data Entry" },
  { key: "assignedAt", label: "Assigned" },
  { key: "readyAt", label: "Marked Ready" },
  { key: "turnaroundHours", label: "Turnaround (hours)" },
  { key: "stage", label: "Stage" },
  { key: "checks", label: "Checks" },
  { key: "checksInitiated", label: "Checks initiated" },
  { key: "l1Raised", label: "L1 raised" },
] as const;
export type DataEntryReportColumn = (typeof DATA_ENTRY_REPORT_COLUMNS)[number]["key"];

export interface DataEntryReportRow {
  caseNumber: string;
  candidate: string;
  client: string;
  dataEntry: string;
  assignedAt: string | null;
  readyAt: string | null;
  turnaroundHours: number | null;
  stage: string;
  checks: number;
  checksInitiated: number;
  l1Raised: number;
}

export interface DataEntryReport {
  from: string;
  to: string;
  total: number;
  summary: { markedReady: number; averageTurnaroundHours: number | null; l1Raised: number };
  rows: DataEntryReportRow[];
}

export interface DataEntryReportFilter {
  from: string;
  to: string;
  scope: "mine" | "team";
}

export const getDataEntryOverview = (scope: "mine" | "team", signal?: AbortSignal) =>
  apiRequest<DataEntryOverview>(`/workflow/data-entry/overview${query({ scope })}`, { signal });

export const getDataEntryReport = (filter: DataEntryReportFilter, signal?: AbortSignal) =>
  apiRequest<DataEntryReport>(`/workflow/data-entry/report${query({ ...filter })}`, { signal });

export const downloadDataEntryReport = async (
  filter: DataEntryReportFilter,
  columns: readonly DataEntryReportColumn[],
) =>
  saveBlob(
    await apiDownload(
      `/workflow/data-entry/report/export${query({ ...filter, columns: columns.join(",") })}`,
    ),
    `Sapling-Global-data-entry-${filter.from}-to-${filter.to}.csv`,
  );

/** Standard colour matrix: per check type, the situations and the colour each means. */
export interface ColourMatrix {
  matrix: Record<string, Array<{ id: string; text: string; colour: string }>>;
  colourNames: Record<string, string>;
  resultFor: Record<string, string>;
}

export const getColourMatrix = () => apiRequest<ColourMatrix>("/workflow/colour-matrix");

/** Response contracts of the read-only /spoc API (backend/src/spoc). */

export type SpocRole =
  | "OPS_MANAGER"
  | "VERIFIER"
  | "QA_REVIEWER"
  | "CLIENT_ADMIN"
  | "FIELD_EXECUTIVE"
  | "SALES_MANAGER"
  | "FINANCE_MANAGER";

export type SpocHolderRole = Exclude<SpocRole, "FIELD_EXECUTIVE" | "SALES_MANAGER"> | "NONE";

export interface SpocPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SpocRoleStatus {
  role: SpocRole;
  basis: string;
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  exceptions: number;
}

export interface SpocStage {
  status: string;
  holderRole: SpocHolderRole;
  count: number;
  oldestAgeHours: number;
  atRisk: number;
}

export interface SpocAttentionItem {
  id: string;
  caseNumber: string;
  status: string;
  priority: string;
  riskLevel: string;
  dueAt: string | null;
  updatedAt: string;
  subject: { fullName: string };
  client: { publicId: string; displayName: string };
  owner: { publicId: string; displayName: string } | null;
  reasons: string[];
  severity: number;
  ageHours: number;
  holderRole: SpocHolderRole;
}

export interface SpocOverview {
  generatedAt: string;
  window: { from: string; to: string };
  kpis: {
    activeCases: number;
    overdue: number;
    slaApproaching: number;
    unassigned: number;
    completed: number;
    qaRework: number;
    openClientActions: number;
    outstanding: number;
    overdueReceivable: number;
    openPipeline: number;
  };
  roles: SpocRoleStatus[];
  workflow: SpocStage[];
  attention: SpocAttentionItem[];
  business: {
    crm: {
      openPipeline: number;
      weightedForecast: number;
      closedWon: number;
      winRate: number | null;
    };
    finance: { billed: number; collected: number; outstanding: number; overdue: number };
  };
}

export interface SpocFilterOptions {
  clients: Array<{ id: string; displayName: string; status: string }>;
  branches: Array<{ id: string; name: string; city: string | null }>;
  users: Array<{ id: string; displayName: string; roles: string[] }>;
}

export type SpocExceptionCategory =
  | "overdue"
  | "sla_approaching"
  | "no_ops_owner"
  | "checks_unassigned"
  | "blocked_tasks"
  | "qa_rework"
  | "non_clear_results"
  | "client_clarifications"
  | "rejected_documents"
  | "field_exception_review"
  | "outside_geofence"
  | "report_failed"
  | "followup_overdue"
  | "invoice_overdue"
  | "credit_hold";

export interface SpocExceptionItem {
  id: string;
  title: string;
  subtitle: string;
  caseId: string | null;
  status: string;
  owner: string | null;
  dueAt: string | null;
  updatedAt: string;
}

export interface SpocExceptions extends SpocPage<SpocExceptionItem> {
  category: SpocExceptionCategory;
  categories: Array<{ category: SpocExceptionCategory; count: number }>;
}

export interface SpocClientRow {
  id: string;
  code: string;
  displayName: string;
  status: string;
  creditHold: boolean;
  total: number;
  active: number;
  waitingOnClient: number;
  completed: number;
  overdue: number;
  openClarifications: number;
  outstanding: number;
  overdueAmount: number;
  onboardingHandoffAt: string | null;
}

export interface SpocCaseRow {
  id: string;
  caseNumber: string;
  externalRef: string | null;
  status: string;
  holderRole: SpocHolderRole;
  currentOwner: string | null;
  priority: string;
  riskLevel: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  overdue: boolean;
  candidateName: string;
  client: { id: string; displayName: string };
  branch: { name: string; city: string | null } | null;
  opsOwner: string | null;
  checksCompleted: number;
  checksTotal: number;
  blockedTasks: number;
  openVisits: number;
}

export interface SpocTaskRow {
  id: string;
  status: string;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  blockerReason: string | null;
  overdue: boolean;
  assignee: { id: string; displayName: string } | null;
  checkType: string;
  checkStatus: string;
  result: string | null;
  caseId: string;
  caseNumber: string;
  caseStatus: string;
  candidateName: string;
  clientName: string;
}

export interface SpocQaRow {
  id: string;
  caseId: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  caseStatus: string;
  priority: string;
  dueAt: string | null;
  reviewer: string | null;
  claimedAt: string | null;
  decision: string | null;
  decidedAt: string | null;
}

export interface SpocVisitRow {
  id: string;
  status: string;
  address: string;
  geofenceMeters: number;
  distanceMeters: number | null;
  outsideGeofence: boolean;
  checkedInAt: string | null;
  completedAt: string | null;
  createdAt: string;
  evidenceCount: number;
  assignee: { id: string; displayName: string } | null;
  caseId: string;
  caseNumber: string;
  caseStatus: string;
  caseDueAt: string | null;
  candidateName: string;
  clientName: string;
}

export interface SpocOpportunityRow {
  id: string;
  companyName: string;
  contactName: string;
  city: string | null;
  stage: string;
  estimatedValue: number;
  probability: number;
  nextFollowUpAt: string | null;
  onboardingHandoffAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  followUpOverdue: boolean;
  owner: { id: string; displayName: string } | null;
  client: { id: string; displayName: string; status: string } | null;
}

export interface SpocInvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  totalAmount: number;
  paidAmount: number;
  creditedAmount: number;
  balance: number;
  client: { id: string; displayName: string };
}

export interface SpocCaseDetail {
  id: string;
  caseNumber: string;
  externalRef: string | null;
  status: string;
  holderRole: SpocHolderRole;
  currentOwner: string | null;
  priority: string;
  riskLevel: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  qaClaimedAt: string | null;
  candidateName: string;
  client: { id: string; displayName: string; status: string };
  branch: { name: string; city: string | null } | null;
  opsOwner: string | null;
  qaReviewer: string | null;
  checks: Array<{
    id: string;
    type: string;
    status: string;
    result: string | null;
    riskLevel: string | null;
    dueAt: string | null;
    completedAt: string | null;
    sourceSummary: string | null;
    tasks: Array<{
      id: string;
      status: string;
      dueAt: string | null;
      completedAt: string | null;
      blockerReason: string | null;
      assignee: string | null;
    }>;
    findings: Array<{ id: string; kind: string; severity: string; title: string }>;
  }>;
  fieldVisits: Array<{
    id: string;
    status: string;
    address: string;
    geofenceMeters: number;
    distanceMeters: number | null;
    checkedInAt: string | null;
    completedAt: string | null;
    assignee: string | null;
    evidenceCount: number;
  }>;
  documents: Array<{
    id: string;
    type: string;
    status: string;
    currentVersion: number;
    updatedAt: string;
  }>;
  clarifications: Array<{
    id: string;
    status: string;
    subject: string;
    dueAt: string | null;
    resolvedAt: string | null;
    createdAt: string;
  }>;
  qaReviews: Array<{
    id: string;
    decision: string;
    notes: string | null;
    createdAt: string;
    reviewer: string;
  }>;
  reports: Array<{
    id: string;
    status: string;
    currentVersion: number;
    publishedAt: string | null;
    createdAt: string;
    releasedAt?: string | null;
    downloadExpiresAt?: string | null;
    latest?: { version: number; generatedAt: string; authenticityCode: string } | null;
    /** Released and within its download period. */
    canDownload?: boolean;
    /** Approved and prepared / released: its PDF can be rebuilt. */
    canRegenerate?: boolean;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    dueAt: string | null;
    lineTotal: number;
  }>;
  statusHistory: Array<{
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
}

export interface SpocActivity {
  items: Array<{
    id: string;
    action: string;
    resourceType: string;
    actorName: string;
    createdAt: string;
  }>;
  nextCursor: string | null;
}

/** Record domains shown on the Records page. */
export type SpocDomain = "cases" | "tasks" | "qa" | "visits" | "opportunities" | "invoices";

export interface SpocOverviewFilters {
  clientId?: string;
  branchId?: string;
  priority?: string;
  from?: string;
  to?: string;
}

export type SpocQuery = Record<string, string | number | boolean | undefined>;

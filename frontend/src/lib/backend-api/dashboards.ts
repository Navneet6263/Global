import { apiDownload, apiRequest, saveBlob } from "./client";

export interface OperationsDashboard {
  summary: {
    total: number;
    overdue: number;
    createdToday: number;
    completedToday: number;
  };
  statusMix: Record<string, number>;
  stageHealth?: Array<{
    status: string;
    count: number;
    oldestAgeHours: number;
    atRisk: number;
  }>;
  outcomeMix: Record<string, number>;
  trend: Array<{ month: string; created: number; completed: number }>;
  recentCases: Array<{
    id: string;
    caseNumber: string;
    status: string;
    priority: string;
    dueAt: string | null;
    updatedAt: string;
    subject: { fullName: string };
    client: { displayName: string };
  }>;
  generatedAt: string;
}

export interface ExecutiveDashboard extends OperationsDashboard {
  performance: {
    averageTatHours: number | null;
    slaPercentage: number | null;
    completedCases: number;
  };
  performanceTrend: Array<{
    month: string;
    created: number;
    slaPercentage: number | null;
    averageTatHours: number | null;
    overdue: number;
  }>;
  riskMix: Record<string, number>;
  attentionQueue: ExecutiveAttentionItem[];
  clientPerformance: ExecutivePerformanceRow[];
  branchPerformance: ExecutivePerformanceRow[];
  stageAgeing: Array<{
    status: string;
    count: number;
    averageAgeHours: number;
    oldestAgeHours: number;
    atRisk: number;
  }>;
  teamCapacity: Array<{
    id: string;
    name: string;
    active: number;
    completed: number;
    overdue: number;
  }>;
  checkPerformance: Array<{
    type: string;
    total: number;
    completed: number;
    pending: number;
    discrepancies: number;
    unableToVerify: number;
    averageTatHours: number | null;
  }>;
  businessHealth: {
    crm: {
      openPipeline: number;
      weightedForecast: number;
      closedWon: number;
      winRate: number | null;
    };
    finance: { billed: number; collected: number; outstanding: number; overdue: number };
  };
  forecast: {
    dueNext7Days: number;
    atRiskNext7Days: number;
    projectedCompletions7Days: number;
    unassignedActive: number;
  };
  caseRegister: ExecutiveCase[];
  filters: {
    clients: Array<{ publicId: string; displayName: string }>;
    branches: Array<{ publicId: string; name: string }>;
    checkTypes: string[];
    priorities: string[];
    riskLevels: string[];
    applied: ExecutiveDashboardFilters & { from: string; to: string };
  };
}

export interface ExecutiveDashboardFilters {
  months?: number;
  from?: string;
  to?: string;
  clientId?: string;
  branchId?: string;
  checkType?: string;
  priority?: string;
  riskLevel?: string;
}

export interface ExecutiveCase {
  id: string;
  caseNumber: string;
  status: string;
  priority: string;
  riskLevel: string;
  createdAt: string;
  completedAt: string | null;
  dueAt: string | null;
  updatedAt: string;
  subject: { fullName: string };
  client: { publicId: string; displayName: string };
  branch: { publicId: string; name: string } | null;
  owner: { publicId: string; displayName: string } | null;
}

export interface ExecutiveAttentionItem extends ExecutiveCase {
  reasons: string[];
  severity: number;
  ageHours: number;
}

export interface ExecutivePerformanceRow {
  id: string;
  name: string;
  total: number;
  active: number;
  completed: number;
  overdue: number;
  slaPercentage: number | null;
  averageTatHours: number | null;
}

type ExceptionCase = {
  publicId: string;
  caseNumber: string;
  subject: { fullName: string };
  client: { displayName: string };
};

export interface ExceptionsDashboard {
  summary: {
    overdue: number;
    clarifications: number;
    fieldExceptions: number;
    rejectedDocuments: number;
    total: number;
    uniqueCases: number;
    critical: number;
    resolvedToday: number;
    averageAgeHours: number;
    clientActions: number;
  };
  overdue: Array<{
    id: string;
    caseNumber: string;
    status: string;
    priority: string;
    dueAt: string;
    createdAt: string;
    subject: { fullName: string };
    client: { displayName: string };
  }>;
  clarifications: Array<{
    id: string;
    status: string;
    subject: string;
    dueAt?: string | null;
    updatedAt: string;
    createdAt: string;
    latestMessage?: {
      senderType: string;
      body: string;
      createdAt: string;
    } | null;
    case: ExceptionCase;
  }>;
  fieldVisits: Array<{
    id: string;
    address: string;
    distanceMeters?: number | null;
    geofenceMeters: number;
    capturedAt?: string | null;
    createdAt: string;
    version: number;
    case: ExceptionCase;
    assignee?: { displayName: string } | null;
  }>;
  rejectedDocuments: Array<{
    id: string;
    type: string;
    status: string;
    updatedAt: string;
    case: ExceptionCase;
  }>;
  generatedAt: string;
}

export interface ClientAnalyticsDashboard {
  branches: Array<{
    id: string | null;
    name: string;
    city: string | null;
    total: number;
    active: number;
    completed: number;
    cancelled: number;
    overdue: number;
    pendingDocuments: number;
    clarifications: number;
    completionPercent: number;
  }>;
  summary: {
    totalChecks: number;
    returnedOutcomes: number;
    nonClear: number;
    nonClearRate: number;
    rejectedDocuments: number;
    qaRework: number;
  };
  bottleneck: { status: string; count: number; oldestAgeHours: number } | null;
  stageHealth: Array<{ status: string; count: number; oldestAgeHours: number }>;
  checkHealth: Array<{
    type: string;
    total: number;
    completed: number;
    pending: number;
    returned: number;
    clear: number;
    discrepancies: number;
    unableToVerify: number;
  }>;
  documentHealth: Array<{
    type: string;
    total: number;
    available: number;
    verified: number;
    rejected: number;
  }>;
  qaDecisions: Record<string, number>;
  generatedAt: string;
}

export function getOperationsDashboard() {
  return apiRequest<OperationsDashboard>("/dashboards/operations");
}

export function getClientAnalyticsDashboard() {
  return apiRequest<ClientAnalyticsDashboard>("/dashboards/client");
}

export function getExecutiveDashboard(filters: ExecutiveDashboardFilters = {}) {
  const query = executiveQuery(filters);
  return apiRequest<ExecutiveDashboard>(`/dashboards/executive${query ? `?${query}` : ""}`);
}

export async function exportExecutiveDashboard(
  format: "csv" | "pdf",
  filters: ExecutiveDashboardFilters,
) {
  const query = executiveQuery({ ...filters, format } as ExecutiveDashboardFilters & {
    format: string;
  });
  const blob = await apiDownload(`/dashboards/executive/export?${query}`);
  saveBlob(blob, `Sapling-Global-Executive-${new Date().toISOString().slice(0, 10)}.${format}`);
}

export function scheduleExecutiveDashboard(
  input: ExecutiveDashboardFilters & {
    recipientEmail: string;
    deliveryAt: string;
    format: "pdf" | "csv";
  },
) {
  return apiRequest<{ scheduled: true; id: string; deliveryAt: string }>(
    "/dashboards/executive/schedule",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function getExceptionsDashboard() {
  return apiRequest<ExceptionsDashboard>("/dashboards/exceptions");
}

function executiveQuery(filters: ExecutiveDashboardFilters & { format?: string }) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

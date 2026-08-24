import { apiRequest } from "./client";

export interface OperationsDashboard {
  summary: {
    total: number;
    overdue: number;
    createdToday: number;
    completedToday: number;
  };
  statusMix: Record<string, number>;
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
    averageTatHours: number;
    slaPercentage: number;
    completedCases: number;
  };
  riskMix: Record<string, number>;
}

type ExceptionCase = {
  publicId: string;
  caseNumber: string;
  subject: { fullName: string };
  client: { displayName: string };
};

export interface ExceptionsDashboard {
  summary: { overdue: number; clarifications: number; fieldExceptions: number; total: number };
  overdue: Array<{
    id: string;
    caseNumber: string;
    status: string;
    priority: string;
    dueAt: string;
    subject: { fullName: string };
    client: { displayName: string };
  }>;
  clarifications: Array<{
    id: string;
    status: string;
    subject: string;
    dueAt?: string | null;
    updatedAt: string;
    case: ExceptionCase;
  }>;
  fieldVisits: Array<{
    id: string;
    address: string;
    distanceMeters?: number | null;
    geofenceMeters: number;
    capturedAt?: string | null;
    case: ExceptionCase;
    assignee?: { displayName: string } | null;
  }>;
  generatedAt: string;
}

export function getOperationsDashboard() {
  return apiRequest<OperationsDashboard>("/dashboards/operations");
}

export function getExecutiveDashboard() {
  return apiRequest<ExecutiveDashboard>("/dashboards/executive");
}

export function getExceptionsDashboard() {
  return apiRequest<ExceptionsDashboard>("/dashboards/exceptions");
}

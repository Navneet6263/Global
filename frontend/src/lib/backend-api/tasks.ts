import { apiRequest } from "./client";

export interface VerificationTask {
  id: string;
  status: string;
  instructions?: string | null;
  dueAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  blockerReason?: string | null;
  blockedAt?: string | null;
  version: number;
  check: {
    publicId: string;
    type: string;
    status: string;
    result?: string | null;
    riskLevel?: string | null;
    sourceSummary?: string | null;
    findings: Array<FindingInput & { publicId: string }>;
    case: {
      publicId: string;
      caseNumber: string;
      priority: string;
      subject: { publicId: string; fullName: string };
      client: { publicId: string; displayName: string };
    };
  };
}

export interface FindingInput {
  kind: "IDENTITY_MISMATCH" | "DATE_MISMATCH" | "ADDRESS_MISMATCH" | "RECORD_FOUND" | "OTHER";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  source?: string;
}

export interface VerifierInsights {
  summary: {
    active: number;
    open: number;
    inProgress: number;
    blocked: number;
    overdue: number;
    dueToday: number;
    dueNext24h: number;
    completedToday: number;
    completedThisWeek: number;
    totalCompleted: number;
    averageTurnaroundMinutes: number;
    slaSampleSize: number;
    slaHitRate: number | null;
  };
  outcomes: { clear: number; discrepancy: number; unableToVerify: number };
  daily: Array<{ date: string; completed: number }>;
}

export interface VerifierTaskContext {
  publicId: string;
  createdAt: string;
  startedAt?: string | null;
  blockedAt?: string | null;
  completedAt?: string | null;
  check: {
    publicId: string;
    type: string;
    case: {
      publicId: string;
      caseNumber: string;
      status: string;
      priority: string;
      dueAt?: string | null;
      subject: {
        publicId: string;
        fullName: string;
        email?: string | null;
        phone?: string | null;
        employeeCode?: string | null;
      };
      client: { publicId: string; displayName: string };
      branch?: { publicId: string; name: string; city?: string | null } | null;
      servicePackage?: { publicId: string; name: string } | null;
      consents: Array<{
        publicId: string;
        status: string;
        acceptedAt?: string | null;
        createdAt: string;
      }>;
      documents: Array<{
        publicId: string;
        type: string;
        status: string;
        currentVersion: number;
        versions: Array<{
          version: number;
          originalName: string;
          contentType: string;
          sizeBytes: string;
          sha256: string;
          malwareState: string;
          createdAt: string;
        }>;
      }>;
      clarifications: Array<{
        publicId: string;
        status: string;
        subject: string;
        dueAt?: string | null;
        createdAt: string;
      }>;
      statusHistory: Array<{
        fromStatus?: string | null;
        toStatus: string;
        reason?: string | null;
        createdAt: string;
      }>;
    };
  };
}

export function getMyTasks(
  input: {
    status?: string;
    view?: "ACTIVE";
    search?: string;
    cursor?: string;
    taskId?: string;
    sla?: "OVERDUE" | "DUE_TODAY" | "DUE_SOON";
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return apiRequest<{
    items: VerificationTask[];
    nextCursor?: string | null;
    summary: { active: number; overdue: number; blocked: number; completedToday: number };
  }>(`/tasks/mine${query ? `?${query}` : ""}`);
}

export function getVerifierInsights() {
  return apiRequest<VerifierInsights>("/tasks/mine/insights");
}

export function getVerifierTaskContext(taskId: string) {
  return apiRequest<VerifierTaskContext>(`/tasks/${taskId}/context`);
}

export function updateTask(
  taskId: string,
  input: {
    status: "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
    version: number;
    result?: "CLEAR" | "DISCREPANCY" | "UNABLE_TO_VERIFY";
    sourceSummary?: string;
    findings: FindingInput[];
  },
) {
  return apiRequest<{ id: string; status: string; version: number }>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function createTask(
  checkId: string,
  input: { assigneeId: string; instructions?: string; dueAt?: string },
) {
  return apiRequest<{ id: string; status: string; version: number }>(`/checks/${checkId}/tasks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

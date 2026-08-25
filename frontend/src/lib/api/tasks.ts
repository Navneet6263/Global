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

export function getMyTasks(
  input: {
    status?: string;
    view?: "ACTIVE";
    search?: string;
    cursor?: string;
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

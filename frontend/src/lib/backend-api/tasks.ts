import { apiRequest } from "./client";

export interface TaskClarificationSummary {
  id: string;
  level?: string | null;
  status: string;
  subject: string;
  requestedDocumentType?: string | null;
  submittedDocumentVersion?: number | null;
  opsReviewedAt?: string | null;
  reentryCompletedAt?: string | null;
  rejectionCount?: number;
  lastRejectedReason?: string | null;
  dueAt?: string | null;
  createdAt: string;
}

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
  assignee?: { id: string; name: string } | null;
  check: {
    publicId: string;
    type: string;
    status: string;
    initiationJson?: string | null;
    initiatedAt?: string | null;
    /** The routed team: decides which process the verifier sees. */
    department?: {
      id?: string;
      name: string;
      teamType?: "EMPLOYMENT" | "EDUCATION" | "VENDOR" | "DIGITAL" | null;
    } | null;
    result?: string | null;
    riskLevel?: string | null;
    sourceSummary?: string | null;
    findings: Array<FindingInput & { publicId: string }>;
    clarifications?: TaskClarificationSummary[];
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
  status?: string;
  assignee?: { id: string; name: string } | null;
  createdAt: string;
  startedAt?: string | null;
  blockedAt?: string | null;
  completedAt?: string | null;
  check: {
    publicId: string;
    type: string;
    initiationJson?: string | null;
    initiatedAt?: string | null;
    department?: {
      id?: string;
      name: string;
      teamType?: "EMPLOYMENT" | "EDUCATION" | "VENDOR" | "DIGITAL" | null;
    } | null;
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
          reviewStatus?: string;
          reviewNote?: string | null;
          reviewedAt?: string | null;
          createdAt: string;
        }>;
      }>;
      clarifications: Array<{
        publicId: string;
        level?: string | null;
        status: string;
        subject: string;
        isForCurrentCheck?: boolean;
        requestedDocumentType?: string | null;
        submittedDocumentVersion?: number | null;
        submittedDocument?: {
          id: string;
          type: string;
          status: string;
          currentVersion: number;
        } | null;
        opsReviewedAt?: string | null;
        reentryCompletedAt?: string | null;
        rejectionCount?: number;
        lastRejectedReason?: string | null;
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
    departmentId?: string;
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

export function getVerifierInsights(departmentId?: string) {
  const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : "";
  return apiRequest<VerifierInsights>(`/tasks/mine/insights${query}`);
}

export function getVerifierTaskContext(taskId: string, departmentId?: string) {
  const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : "";
  return apiRequest<VerifierTaskContext>(`/tasks/${taskId}/context${query}`);
}

export function updateTask(
  taskId: string,
  input: {
    status: "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
    version: number;
    result?: "CLEAR" | "DISCREPANCY" | "UNABLE_TO_VERIFY";
    /** Colour code; defaults from the result when omitted. */
    disposition?: string;
    sourceSummary?: string;
    findings: FindingInput[];
  },
) {
  return apiRequest<{
    id: string;
    status: string;
    version: number;
    /** The check now waits for its Team Leader's review before QA. */
    tlReview?: boolean;
    /** The person who finished it leads the team: offer "Forward to QA" now. */
    canForward?: boolean;
  }>(`/tasks/${taskId}`, {
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

/** Team Leader: the finished check is fine; complete it so the case can go to QA. */
export function forwardTask(taskId: string, note?: string) {
  return apiRequest<{ id: string; status: string; caseToQa: boolean }>(`/tasks/${taskId}/forward`, {
    method: "POST",
    body: JSON.stringify(note ? { note } : {}),
  });
}

/** Team Leader: send the finished check back to its verifier with what to fix. */
export function sendBackTask(taskId: string, reason: string) {
  return apiRequest<{ id: string; status: string }>(`/tasks/${taskId}/send-back`, {
    method: "POST",
    body: JSON.stringify({ note: reason }),
  });
}

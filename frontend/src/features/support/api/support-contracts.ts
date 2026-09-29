import type { SpocHolderRole } from "@/features/spoc-rm/contracts/spoc";

export type SupportCaseState = "PENDING" | "COMPLETED" | "EXCEPTION" | "CANCELLED";
export type SupportRequestStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export type SupportRequesterType = "CANDIDATE" | "CLIENT_ADMIN";

export interface SupportPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SupportSummary {
  clients: number;
  activeEmployees: number;
  exceptions: number;
  openRequests: number;
}

export interface SupportClientRow {
  id: string;
  code: string;
  displayName: string;
  status: string;
  employees: number;
  active: number;
  completed: number;
  cancelled: number;
  exceptions: number;
  openRequests: number;
  lastUpdated: string | null;
}

/** One employee (candidate case). Status metadata only: no contact details or files. */
export interface SupportEmployeeRow {
  id: string;
  caseNumber: string;
  candidateName: string;
  client: { id: string; displayName: string };
  branch: { name: string; city: string | null } | null;
  status: string;
  holderRole: SpocHolderRole;
  currentOwner: string | null;
  priority: string;
  dueAt: string | null;
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  checks: { completed: number; total: number };
  documents: {
    uploaded: number;
    verified: number;
    awaitingReview: number;
    needsCorrection: number;
  };
  openClarifications: number;
  blockedTasks: number;
  state: SupportCaseState;
  exceptionReasons: string[];
}

export interface SupportRequestRow {
  id: string;
  requestNumber: string;
  requesterType: SupportRequesterType;
  requesterName: string;
  client: { id: string; displayName: string };
  employee: {
    caseId: string;
    caseNumber: string;
    candidateName: string;
    caseStatus: string;
  } | null;
  subject: string;
  message: string;
  status: SupportRequestStatus;
  takenBy: string | null;
  takenByMe: boolean;
  resolutionNote: string | null;
  resolvedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupportEmployeeDetail extends SupportEmployeeRow {
  pendingItems: string[];
  history: Array<{
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
  checkList: Array<{
    type: string;
    status: string;
    completedAt: string | null;
    tasks: Array<{
      status: string;
      dueAt: string | null;
      assignee: string | null;
      blockerReason: string | null;
    }>;
  }>;
  documentList: Array<{
    id: string;
    type: string;
    status: string;
    currentVersion: number;
    reviewNote: string | null;
    uploadedAt: string | null;
    updatedAt: string;
    vendorStatus: "NOT_ASSIGNED" | "PENDING" | "APPROVED" | "REJECTED";
  }>;
  clarifications: Array<{
    subject: string;
    status: string;
    dueAt: string | null;
    createdAt: string;
  }>;
  consentStatus: string;
  reportPublished: boolean;
  supportRequests: SupportRequestRow[];
}

/** A request as its own requester (candidate or Client Admin) sees it. */
export interface MySupportRequest {
  id: string;
  requestNumber: string;
  subject: string;
  caseNumber: string | null;
  status: SupportRequestStatus;
  reply: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportEmployeeQuery {
  page: number;
  pageSize: number;
  search?: string;
  clientId?: string;
  state?: SupportCaseState;
}

export interface SupportRequestQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: SupportRequestStatus;
  requesterType?: SupportRequesterType;
  mine?: boolean;
}

export interface RaiseSupportRequestInput {
  subject: string;
  message: string;
  caseNumber?: string;
}

export interface UpdateSupportRequestInput {
  requestId: string;
  status: "IN_PROGRESS" | "RESOLVED";
  version: number;
  note?: string;
}

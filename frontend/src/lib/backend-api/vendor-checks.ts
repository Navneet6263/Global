import { apiDownload, apiRequest, saveBlob } from "./client";
import { openDocumentPreview } from "./document-preview";
import { fileSha256 } from "./file-digest";
import type { InitiationForm } from "./workflow";

export type VendorJobStatus =
  | "PENDING_APPROVAL"
  | "REJECTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "RETURNED"
  | "APPROVED"
  | "DECLINED"
  | "CANCELLED";
export type VendorAssignedAs = "OPERATIONS" | "RM" | "TEAM_LEADER";
export type VendorResult = "CLEAR" | "DISCREPANCY" | "UNABLE_TO_VERIFY";
export type Entry = Record<string, string>;

export interface VendorJob {
  id: string;
  attempt: number;
  status: VendorJobStatus;
  checkId: string;
  checkType: string;
  caseId: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  vendor: { id: string; name: string };
  handler: { id: string; name: string } | null;
  assignedBy: string;
  reviewedBy: string | null;
  note: string | null;
  dueAt: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  result: VendorResult | null;
  remarks: string | null;
  declineReason: string | null;
  reviewNote: string | null;
  /** Who sent it: decides who reviews the vendor's result. */
  assignedAs: VendorAssignedAs | null;
  /** A Team Leader's reason, for the RM's approval (internal only). */
  requestReason: string | null;
  approval: { by: string | null; at: string; note: string | null } | null;
  evidenceCount: number;
  version: number;
  ageDays: number;
  ageing: "0-2" | "3-5" | "6-10" | "10+" | null;
  overdue: boolean;
}

export interface VendorFile {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface VendorBoard {
  summary: {
    counts: Partial<Record<VendorJobStatus, number>>;
    ageing: Record<"0-2" | "3-5" | "6-10" | "10+", number>;
    overdue: number;
  };
  items: VendorJob[];
}

export interface BoardFilter {
  status?: VendorJobStatus;
  search?: string;
  overdue?: boolean;
}

export const EXPORT_COLUMNS = [
  { key: "caseNumber", label: "Sapling ID" },
  { key: "candidate", label: "Candidate" },
  { key: "client", label: "Client" },
  { key: "check", label: "Check" },
  { key: "vendor", label: "Vendor" },
  { key: "handler", label: "Handled by" },
  { key: "status", label: "Status" },
  { key: "assignedAt", label: "Assigned" },
  { key: "dueAt", label: "Due" },
  { key: "ageDays", label: "Age (days)" },
  { key: "overdue", label: "Overdue" },
  { key: "submittedAt", label: "Submitted" },
  { key: "result", label: "Result" },
  { key: "reviewedAt", label: "Reviewed" },
] as const;
export type ExportColumn = (typeof EXPORT_COLUMNS)[number]["key"];

const filterQuery = (filter: BoardFilter, columns?: readonly string[]) => {
  const query = new URLSearchParams();
  if (filter.status) query.set("status", filter.status);
  if (filter.search) query.set("search", filter.search);
  if (filter.overdue) query.set("overdue", "true");
  if (columns?.length) query.set("columns", columns.join(","));
  const text = query.toString();
  return text ? `?${text}` : "";
};

/* ---------- Internal (Operations, RM, Team Leader, verifier) ---------- */

export interface CheckVendorState {
  checkId: string;
  checkType: string;
  canManage: boolean;
  /** How the viewer would send it; null = can only look (a plain verifier). */
  assignAs: VendorAssignedAs | null;
  /** A Team Leader gives a reason and the case RM approves first. */
  needsApproval: boolean;
  canAssign: boolean;
  vendors: Array<{ id: string; name: string }>;
  documents: Array<{ id: string; type: string; name: string; suggested: boolean }>;
  rhsForm: InitiationForm;
  attempts: Array<
    VendorJob & {
      submission: Entry[];
      evidence: VendorFile[];
      canApprove: boolean;
      canReview: boolean;
      canCancel: boolean;
    }
  >;
}

export const internalVendorApi = {
  forCheck: (checkId: string) => apiRequest<CheckVendorState>(`/checks/${checkId}/vendor`),
  assign: (
    checkId: string,
    input: {
      vendorId: string;
      dueAt?: string;
      note?: string;
      /** Team Leader: why (shown to the RM, never to the vendor). */
      reason?: string;
      documentIds: string[];
    },
  ) =>
    apiRequest<{ id: string; attempt: number; status: VendorJobStatus }>(
      `/checks/${checkId}/vendor`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),
  review: (id: string, input: { decision: "APPROVE" | "RETURN"; note?: string; version: number }) =>
    apiRequest<{ id: string; status: VendorJobStatus }>(`/vendor-checks/${id}/review`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  /** The case RM approves or turns down a Team Leader's request. */
  decide: (id: string, input: { decision: "APPROVE" | "REJECT"; note?: string; version: number }) =>
    apiRequest<{ id: string; status: VendorJobStatus }>(`/vendor-checks/${id}/approval`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancel: (id: string, reason: string) =>
    apiRequest<{ id: string }>(`/vendor-checks/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  board: (filter: BoardFilter) => apiRequest<VendorBoard>(`/vendor-checks${filterQuery(filter)}`),
  export: async (filter: BoardFilter, columns: readonly string[]) =>
    saveBlob(
      await apiDownload(`/vendor-checks/export${filterQuery(filter, columns)}`),
      "Sapling-Global-vendor-work.csv",
    ),
  openEvidence: (id: string, fileId: string) =>
    openDocumentPreview(() => apiDownload(`/vendor-checks/${id}/evidence/${fileId}`)),
};

/* ---------- Vendor workspace ---------- */

export interface VendorJobDetail extends VendorJob {
  canDelegate: boolean;
  team: Array<{ id: string; name: string }>;
  lhs: { form: InitiationForm | null; entries: Entry[] };
  rhsForm: InitiationForm;
  results: VendorResult[];
  submission: Entry[];
  documents: Array<{ id: string; type: string; name: string; contentType: string }>;
  evidence: VendorFile[];
}

const job = (id: string) => `/vendor/checks/${encodeURIComponent(id)}`;

export const vendorWorkApi = {
  list: (filter: BoardFilter) => apiRequest<VendorBoard>(`/vendor/checks${filterQuery(filter)}`),
  export: async (filter: BoardFilter, columns: readonly string[]) =>
    saveBlob(
      await apiDownload(`/vendor/checks/export${filterQuery(filter, columns)}`),
      "Sapling-Global-my-checks.csv",
    ),
  detail: (id: string) => apiRequest<VendorJobDetail>(job(id)),
  accept: (id: string, version: number) =>
    apiRequest<{ version: number }>(`${job(id)}/accept`, {
      method: "POST",
      body: JSON.stringify({ version }),
    }),
  decline: (id: string, version: number, reason: string) =>
    apiRequest<{ version: number }>(`${job(id)}/decline`, {
      method: "POST",
      body: JSON.stringify({ version, reason }),
    }),
  saveDraft: (
    id: string,
    input: { version: number; entries: Entry[]; result?: string; remarks?: string },
  ) =>
    apiRequest<{ version: number }>(`${job(id)}/draft`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  submit: (id: string, version: number) =>
    apiRequest<{ version: number }>(`${job(id)}/submit`, {
      method: "POST",
      body: JSON.stringify({ version }),
    }),
  delegate: (id: string, version: number, userId: string | null) =>
    apiRequest<{ version: number }>(`${job(id)}/delegate`, {
      method: "POST",
      body: JSON.stringify({ version, userId }),
    }),
  uploadEvidence: async (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file, file.name);
    return apiRequest<VendorFile>(`${job(id)}/evidence`, {
      method: "POST",
      headers: { "x-content-sha256": await fileSha256(file) },
      body,
    });
  },
  removeEvidence: (id: string, fileId: string) =>
    apiRequest<{ removed: true }>(`${job(id)}/evidence/${fileId}`, { method: "DELETE" }),
  openEvidence: (id: string, fileId: string) =>
    openDocumentPreview(() => apiDownload(`${job(id)}/evidence/${fileId}`)),
  openDocument: (id: string, documentId: string) =>
    openDocumentPreview(() => apiDownload(`${job(id)}/documents/${documentId}`)),
};

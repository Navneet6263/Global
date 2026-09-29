import type { SpocPage } from "../contracts/spoc";

export type VendorAssignmentStatus = "PENDING" | "APPROVED" | "REJECTED";
export type VendorDocumentStatus = "NOT_ASSIGNED" | VendorAssignmentStatus;

export interface SpocVendorClientRow {
  id: string;
  code: string;
  displayName: string;
  status: string;
  uploaded: number;
  notAssigned: number;
  pending: number;
  approved: number;
  rejected: number;
}

/** One attempt of a document's vendor chain; rejected attempts are never edited. */
export interface VendorAttempt {
  id: string;
  attempt: number;
  status: VendorAssignmentStatus;
  version: number;
  documentVersion: number;
  vendor: { id: string; name: string };
  assignedBy: string;
  assignedAt: string;
  note: string | null;
  resolutionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  reason: string | null;
}

export interface VendorFile {
  version: number;
  name: string;
  contentType: string;
  sizeBytes: string;
  uploadedAt: string;
}

/** Where a vendor-rejected document stands in the candidate re-upload loop. */
export type ReuploadState = "NONE" | "REQUESTED" | "RECEIVED";

export interface ReuploadInfo {
  state: ReuploadState;
  /** The candidate-facing message, shown only while the re-upload is awaited. */
  message: string | null;
  requestedAt: string | null;
}

export interface SpocVendorDocumentRow {
  id: string;
  type: string;
  internalStatus: string;
  /** Document.version, sent back with a re-upload request (optimistic check). */
  version: number;
  caseId: string;
  caseNumber: string;
  caseStatus: string;
  candidateName: string;
  updatedAt: string;
  file: VendorFile | null;
  vendorStatus: VendorDocumentStatus;
  current: VendorAttempt | null;
  canAssign: boolean;
  canReassign: boolean;
  canRequestReupload: boolean;
  reupload: ReuploadInfo;
}

export interface DocumentVersionEntry {
  version: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ReuploadRequestEntry {
  requestedAt: string;
  requestedBy: string | null;
  message: string | null;
  documentVersion: number | null;
  attempt: number | null;
}

export interface SpocVendorDocumentDetail extends SpocVendorDocumentRow {
  client: { id: string; displayName: string };
  history: VendorAttempt[];
  candidateLink: { active: boolean; expiresAt: string } | null;
  versions: DocumentVersionEntry[];
  reuploadHistory: ReuploadRequestEntry[];
}

export interface SpocVendorDocumentsPage extends SpocPage<SpocVendorDocumentRow> {
  client: { id: string; code: string; displayName: string; status: string };
}

export interface VendorOption {
  id: string;
  name: string;
  pending: number;
}

export interface VendorAssignmentResult {
  id: string;
  attempt: number;
  status: VendorAssignmentStatus;
  version: number;
  documentVersion: number;
  assignedAt: string;
  vendor: { id: string; name: string };
}

export type AssignVendorInput =
  | { mode: "assign"; documentId: string; vendorId: string; note?: string }
  | {
      mode: "reassign";
      assignmentId: string;
      version: number;
      vendorId: string;
      resolutionNote: string;
    };

export interface RequestReuploadInput {
  documentId: string;
  version: number;
  message: string;
}

export interface RequestReuploadResult {
  id: string;
  status: string;
  version: number;
  requestedAt: string;
  candidateLink: { active: boolean; expiresAt: string } | null;
  candidateMessage: "EMAIL" | "SMS" | null;
}

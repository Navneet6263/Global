export type VendorRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type VendorDecision = "APPROVED" | "REJECTED";

export interface VendorRequestRow {
  id: string;
  attempt: number;
  status: VendorRequestStatus;
  documentType: string;
  caseNumber: string;
  clientName: string;
  assignedBy: string;
  assignedAt: string;
  decidedAt: string | null;
  /** Team user the Main Vendor delegated this to; null = the Main Vendor. */
  handledBy: string | null;
  hasReport: boolean;
}

/** The latest report of an approved request (the storage key is never sent). */
export interface VendorReport {
  id: string;
  version: number;
  name: string;
  contentType: "application/pdf" | "image/png";
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface VendorRequestPage {
  items: VendorRequestRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { pending: number; approved: number; rejected: number };
}

/** Exactly what the server allows a vendor to see for one assigned document. */
export interface VendorRequestDetail {
  id: string;
  attempt: number;
  status: VendorRequestStatus;
  version: number;
  documentType: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  assignedBy: string;
  assignedAt: string;
  note: string | null;
  resolutionNote: string | null;
  decidedAt: string | null;
  reason: string | null;
  handler: { id: string; name: string } | null;
  delegatedAt: string | null;
  lastRemindedAt: string | null;
  /** Server-decided: only the Main Vendor, only while pending. */
  canDelegate: boolean;
  canRemind: boolean;
  /** Approve first, then upload: true only for an APPROVED request. */
  canUploadReport: boolean;
  report: VendorReport | null;
  file: {
    version: number;
    name: string;
    contentType: string;
    sizeBytes: string;
    uploadedAt: string;
  } | null;
}

export interface VendorRequestQuery {
  status?: VendorRequestStatus;
  page: number;
  pageSize: number;
  search?: string;
}

export interface VendorDecisionInput {
  requestId: string;
  decision: VendorDecision;
  reason?: string;
  version: number;
}

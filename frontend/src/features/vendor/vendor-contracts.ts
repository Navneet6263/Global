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

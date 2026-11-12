import type { InitiationForm } from "./workflow";

export const L2_MAX_UPLOAD_BYTES = 10_485_760;
export const L2_ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export const CHECK_DOCUMENT_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  ADDRESS: ["ADDRESS_PROOF", "AADHAAR"],
  EMPLOYMENT: ["EMPLOYMENT_PROOF"],
  EDUCATION: ["EDUCATION_CERTIFICATE"],
  COURT_RECORD: ["AADHAAR", "ADDRESS_PROOF", "PAN"],
  CRIMINAL: ["AADHAAR", "ADDRESS_PROOF", "PAN"],
  DRUG_TEST: ["AADHAAR", "PAN"],
  IDENTITY: ["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENCE"],
  PAN_VALIDATION: ["PAN", "AADHAAR"],
  REFERENCE: ["EMPLOYMENT_PROOF", "OTHER"],
  DIGITAL_ADDRESS: ["ADDRESS_PROOF", "AADHAAR"],
  CORPORATE_ADDRESS: ["ADDRESS_PROOF", "OTHER"],
  UAN_CHECK: ["EMPLOYMENT_PROOF", "PAN", "AADHAAR"],
  INDIA_DATABASE: ["AADHAAR", "PAN"],
  SOCIAL_MEDIA: ["OTHER", "AADHAAR", "PAN"],
  CREDIT_CHECK: ["PAN", "AADHAAR"],
  BANK_ACCOUNT: ["BANK_PROOF", "PAN", "AADHAAR"],
};

export function allowedDocumentTypesForCheck(checkType?: string | null): string[] {
  const key = checkType?.trim().toUpperCase() ?? "";
  const specific = CHECK_DOCUMENT_OPTIONS[key] ?? [];
  return [...new Set([...specific, "AADHAAR", "PAN", "OTHER"])];
}

export function validateCandidateL2File(file: {
  type: string;
  size: number;
  name?: string;
}): string | null {
  if (!L2_ALLOWED_MIME_TYPES.includes(file.type as (typeof L2_ALLOWED_MIME_TYPES)[number])) {
    return "Upload a PDF, JPEG or PNG document.";
  }
  if (file.size <= 0) {
    return "Selected file is empty.";
  }
  if (file.size > L2_MAX_UPLOAD_BYTES) {
    return "File must be 10 MB or smaller.";
  }
  return null;
}

export function validateRejectionReason(reason: string): string | null {
  const len = reason.trim().length;
  if (len < 5) return "Enter at least 5 characters explaining what must be fixed.";
  if (len > 1000) return "Rejection reason cannot exceed 1000 characters.";
  return null;
}

export interface DocumentVersionSummary {
  version: number;
  originalName: string;
  contentType: string;
  sizeBytes: string;
  malwareState: string;
  reviewStatus: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  clarificationId?: string | null;
  isSubmitted?: boolean;
}

export interface SubmittedClarificationDocument {
  id: string;
  type: string;
  status: string;
  currentVersion: number;
  versions?: DocumentVersionSummary[];
}

export interface ClarificationUserSummary {
  id: string;
  displayName: string;
}

export interface OpsL2ClarificationItem {
  id: string;
  status: string;
  level: string | null;
  subject: string;
  requestedDocumentType: string | null;
  submittedDocumentVersion: number | null;
  opsReviewedAt: string | null;
  opsReviewedBy: ClarificationUserSummary | null;
  opsReviewNote: string | null;
  dataEntryReviewedAt: string | null;
  dataEntryReviewNote: string | null;
  reentryCompletedAt: string | null;
  rejectionCount: number;
  lastRejectedAt: string | null;
  lastRejectedReason: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  check: { id: string; type: string; status: string } | null;
  case: {
    id: string;
    caseNumber: string;
    status: string;
    workflowVersion: number;
    intakeStage: string | null;
    dataEntryUser: ClarificationUserSummary | null;
    subjectName: string;
    clientName: string;
  };
  submittedDocument: SubmittedClarificationDocument | null;
  messages: Array<{ senderType: string; body: string; createdAt: string }>;
}

export interface OpsL2QueueResponse {
  items: OpsL2ClarificationItem[];
  dataEntryUsers: ClarificationUserSummary[];
}

export interface ReentryDependentCheck {
  checkId: string;
  checkType: string;
  status: string;
  willReopen: boolean;
}

export interface ReentryClarificationItem {
  id: string;
  status: string;
  level: string | null;
  subject: string;
  requestedDocumentType: string | null;
  submittedDocumentVersion: number | null;
  opsReviewedAt: string | null;
  opsReviewedBy?: ClarificationUserSummary | null;
  opsReviewNote: string | null;
  rejectionCount: number;
  lastRejectedAt: string | null;
  lastRejectedReason: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  case: {
    id: string;
    caseNumber: string;
    status: string;
    workflowVersion: number;
    intakeStage: string | null;
    subjectName: string;
    clientName: string;
  };
  check: {
    id: string;
    type: string;
    status: string;
    initiatedAt: string | null;
    entries: Array<Record<string, string>>;
    form: InitiationForm | null;
  } | null;
  submittedDocument: SubmittedClarificationDocument | null;
  dependentChecks: {
    count: number;
    items: ReentryDependentCheck[];
  };
  messages: Array<{ senderType: string; body: string; createdAt: string }>;
}

export interface CandidateL2SubmitResponse {
  clarificationId: string;
  status: "CANDIDATE_SUBMITTED";
  documentId: string;
  documentType: string;
  submittedDocumentVersion: number;
  preservedBaseline: boolean;
  submittedAt: string;
}

export type ClarificationPortalMode = "ops" | "rm";

export type SharedL1QueueState = "all" | "overdue" | "awaiting_client" | "response_received";

export interface SharedL1ClarificationItem {
  id: string;
  caseId: string;
  caseNumber: string;
  caseStatus: string;
  candidateName: string;
  clientId: string;
  clientName: string;
  checkType: string | null;
  status: string;
  level: string | null;
  subject: string;
  raisedBy: ClarificationUserSummary | null;
  dueAt: string | null;
  overdue: boolean;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestMessage: {
    senderType: string;
    body: string;
    createdAt: string;
  } | null;
}

export interface SharedL1QueueResponse {
  items: SharedL1ClarificationItem[];
}

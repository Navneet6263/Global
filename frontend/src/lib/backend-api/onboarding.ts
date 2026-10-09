import { apiDownload, apiRequest, saveBlob } from "./client";
import { fileSha256 } from "./file-digest";

export type OnboardingDocumentState = "MISSING" | "PENDING" | "APPROVED" | "REJECTED";

export interface OnboardingDocument {
  type: string;
  label: string;
  hint: string;
  required: boolean;
  signed: boolean;
  agreementId: string | null;
  signedAt: string | null;
  state: OnboardingDocumentState;
  file: {
    id: string;
    revision: number;
    status: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    reviewNotes: string | null;
    reviewedAt: string | null;
    version: number;
    uploadedBy?: string;
  } | null;
}

export interface OnboardingProgress {
  detailsDone: boolean;
  documentsUploaded: number;
  documentsApproved: number;
  documentsRequired: number;
  commercialDone: boolean;
  rmAssigned: boolean;
  clientDone: boolean;
  missing: string[];
  done: number;
  total: number;
  percent: number;
}

export interface OnboardingSummary {
  id: string;
  code: string;
  legalName: string;
  displayName: string;
  contactName: string | null;
  contactEmail: string | null;
  status: "ONBOARDING" | "ACTIVE" | "SUSPENDED";
  version: number;
  signedUpAt: string | null;
  submittedAt: string | null;
  rm: { id: string; name: string; email: string; phone: string | null } | null;
  rmAssignedAt: string | null;
  progress: OnboardingProgress;
  flags?: { personalEmail: boolean; possibleDuplicates: string[] };
}

export interface OnboardingCompany extends OnboardingSummary {
  contactPhone: string | null;
  gstin: string | null;
  pan: string | null;
  billingAddress: string | null;
  billingTerms: string | null;
  note: string | null;
  packages: Array<{ name: string; tatHours: number | null }>;
  documents: OnboardingDocument[];
}

export interface OnboardingDetail extends OnboardingCompany {
  flags: { personalEmail: boolean; possibleDuplicates: string[] };
  rates: Array<{
    servicePackageId: string;
    name: string;
    unitPrice: number;
    taxRate: number;
    tatHours: number | null;
    active: boolean;
  }>;
  catalog: Array<{ id: string; name: string; price: number | null; tatHours: number }>;
  timeline: Array<{ action: string; at: string; by: string }>;
  canManage: boolean;
  /** Operations sets any price; the company's RM uses list prices plus a limited discount. */
  canSetPrice?: boolean;
  canMessage: boolean;
}

export interface OnboardingList {
  items: Array<
    OnboardingSummary & { flags: { personalEmail: boolean; possibleDuplicates: string[] } }
  >;
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; needsRm: number; submitted: number; inProgress: number };
}

// ---- Company admin ---------------------------------------------------------------

export function getMyOnboarding() {
  return apiRequest<OnboardingCompany>("/onboarding/me");
}

export function updateMyCompany(input: {
  version: number;
  legalName: string;
  displayName: string;
  gstin?: string;
  pan?: string;
  billingAddress?: string;
  contactName?: string;
  contactPhone?: string;
}) {
  return apiRequest<OnboardingCompany>("/onboarding/me/company", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function uploadMyDocument(type: string, file: File, signedOn?: string) {
  const body = new FormData();
  body.append("file", file, file.name);
  const digest = await fileSha256(file);
  const query = signedOn ? `?signedOn=${encodeURIComponent(signedOn)}` : "";
  return apiRequest<{ id: string; revision: number; company: OnboardingCompany }>(
    `/onboarding/me/documents/${type}${query}`,
    { method: "POST", headers: { "x-content-sha256": digest }, body },
  );
}

export async function downloadMyDocument(document: OnboardingDocument) {
  if (!document.agreementId || !document.file) return;
  const blob = await apiDownload(
    `/onboarding/me/documents/${document.agreementId}/files/${document.file.id}`,
  );
  saveBlob(blob, document.file.name);
}

export function submitMyOnboarding(input: { version: number; note?: string }) {
  return apiRequest<OnboardingCompany>("/onboarding/me/submit", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---- Operations / RM / Platform Admin --------------------------------------------

export function listOnboarding(query: {
  status?: string;
  view?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return apiRequest<OnboardingList>(`/onboarding/companies?${params.toString()}`);
}

export function getOnboarding(clientId: string) {
  return apiRequest<OnboardingDetail>(`/onboarding/companies/${clientId}`);
}

export async function downloadOnboardingDocument(clientId: string, document: OnboardingDocument) {
  if (!document.agreementId || !document.file) return;
  const blob = await apiDownload(
    `/onboarding/companies/${clientId}/documents/${document.agreementId}/files/${document.file.id}`,
  );
  saveBlob(blob, document.file.name);
}

export function reviewOnboardingDocument(
  clientId: string,
  document: OnboardingDocument,
  input: { status: "APPROVED" | "REJECTED"; notes: string; signaturesChecked: boolean },
) {
  return apiRequest<OnboardingDetail>(
    `/onboarding/companies/${clientId}/documents/${document.agreementId}/files/${document.file?.id}/review`,
    {
      method: "POST",
      body: JSON.stringify({ ...input, version: document.file?.version }),
    },
  );
}

export function updateOnboardingCommercial(
  clientId: string,
  input: {
    version: number;
    billingTerms: string;
    packages: Array<{
      servicePackageId: string;
      unitPrice: number;
      taxRate: number;
      tatHours?: number;
      active: boolean;
    }>;
  },
) {
  return apiRequest<OnboardingDetail>(`/onboarding/companies/${clientId}/commercial`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function messageOnboarding(clientId: string, message: string) {
  return apiRequest<OnboardingDetail>(`/onboarding/companies/${clientId}/message`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function activateOnboarding(clientId: string, input: { version: number; note?: string }) {
  return apiRequest<OnboardingDetail>(`/onboarding/companies/${clientId}/activate`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function rejectOnboarding(clientId: string, input: { version: number; reason: string }) {
  return apiRequest<OnboardingDetail>(`/onboarding/companies/${clientId}/reject`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type OnboardingActivityKind = "DOCUMENTS" | "PRICING" | "PEOPLE" | "DECISIONS";

export interface OnboardingActivityItem {
  id: string;
  action: string;
  kind: OnboardingActivityKind | "OTHER";
  at: string;
  by: string;
  byRole: string | null;
  /** Short, allow-listed detail: document, decision, package, discount or RM. */
  detail: string | null;
  outcome: "good" | "bad" | null;
}

export function getOnboardingActivity(
  clientId: string,
  input: { page: number; pageSize: number; kind?: OnboardingActivityKind },
) {
  const query = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.kind) query.set("kind", input.kind);
  return apiRequest<{
    items: OnboardingActivityItem[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/onboarding/companies/${clientId}/activity?${query.toString()}`);
}

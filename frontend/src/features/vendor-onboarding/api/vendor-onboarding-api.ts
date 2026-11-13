import { apiDownload, apiRequest, saveBlob } from "@/lib/backend-api/client";
import { openDocumentPreview } from "@/lib/backend-api/document-preview";
import { fileSha256 } from "@/lib/backend-api/file-digest";

export interface VendorSignupStartInput {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  businessType?: string;
  phone?: string;
  isAuthorisedSignatory: boolean;
  acceptTerms: boolean;
}

export interface VendorChallenge {
  signupId: string;
  email: string;
  expiresAt: string;
  resendAfterSeconds: number;
}

export interface VendorProfileData {
  publicId: string;
  businessName: string;
  businessType?: string;
  registrationNumber?: string | null;
  taxId?: string | null;
  websiteUrl?: string | null;
  operatingAddress?: string | null;
  verificationStatus: "PENDING_UPLOAD" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  submittedAt?: string | null;
  termsVersion: string;
  termsAcceptedAt: string;
}

export interface VendorDocumentItem {
  publicId: string;
  documentType: "COMPANY_PAN" | "GST_CERTIFICATE" | "BUSINESS_REGISTRATION";
  status: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  latestRevision?: {
    publicId: string;
    revisionNumber: number;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";
    decisionReason?: string | null;
  } | null;
}

export interface VendorOnboardingResponse {
  profile: VendorProfileData;
  isMainVendor: boolean;
  documents: VendorDocumentItem[];
  canSubmit: boolean;
}

export interface OpsVendorCounts {
  pendingReview: number;
  approved: number;
  rejected: number;
  pendingUpload?: number;
  onboarding?: number;
  all: number;
}

export interface OpsVendorListResponse {
  items: OpsVendorListItem[];
  counts: OpsVendorCounts;
}

export interface OpsVendorListItem {
  publicId: string;
  businessName: string;
  businessType?: string;
  verificationStatus: "PENDING_UPLOAD" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  submittedAt?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  contact: {
    displayName: string;
    email: string;
    phone?: string | null;
  };
  documentsCount: number;
  verifiedDocumentsCount: number;
}

export function startVendorSignup(input: VendorSignupStartInput) {
  return apiRequest<VendorChallenge>("/auth/vendor/signup/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function resendVendorOtp(signupId: string) {
  return apiRequest<VendorChallenge>("/auth/vendor/signup/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signupId }),
  });
}

export function verifyVendorOtp(signupId: string, otp: string) {
  return apiRequest<{ authenticated: true }>("/auth/vendor/signup/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signupId, otp }),
  });
}

export function getVendorOnboardingMine() {
  return apiRequest<VendorOnboardingResponse>("/vendor/onboarding/me");
}

export async function uploadVendorDocument(documentType: string, file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  const digest = await fileSha256(file);
  return apiRequest<{ documentPublicId: string; revisionNumber: number; fileName: string }>(
    `/vendor/onboarding/me/document?documentType=${encodeURIComponent(documentType)}`,
    {
      method: "POST",
      headers: { "x-content-sha256": digest },
      body: form,
    },
  );
}

export async function downloadVendorDocument(docId: string, filename = "document.pdf") {
  const blob = await apiDownload(`/vendor/onboarding/me/document/${encodeURIComponent(docId)}/download`);
  saveBlob(blob, filename);
}

export async function downloadOpsVendorDocument(
  vendorProfileId: string,
  docId: string,
  filename = "document.pdf",
) {
  const blob = await apiDownload(
    `/operations/vendor-onboarding/${encodeURIComponent(vendorProfileId)}/documents/${encodeURIComponent(docId)}/download`,
  );
  saveBlob(blob, filename);
}

export function previewOpsVendorDocument(vendorProfileId: string, docId: string) {
  return openDocumentPreview(() =>
    apiDownload(
      `/operations/vendor-onboarding/${encodeURIComponent(vendorProfileId)}/documents/${encodeURIComponent(docId)}/download`,
    ),
  );
}

export function submitVendorOnboarding() {
  return apiRequest<{ success: true; message: string }>("/vendor/onboarding/me/submit", {
    method: "POST",
  });
}

export function updateVendorProfile(input: {
  registrationNumber?: string;
  taxId?: string;
  websiteUrl?: string;
  operatingAddress?: string;
}) {
  return apiRequest<VendorProfileData>("/vendor/onboarding/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getOpsVendorList(status?: string, search?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  return apiRequest<OpsVendorListResponse>(`/operations/vendor-onboarding?${params.toString()}`);
}

export function getOpsVendorDetail(vendorProfileId: string) {
  return apiRequest<any>(`/operations/vendor-onboarding/${vendorProfileId}`);
}

export function reviewOpsVendorDocument(
  vendorProfileId: string,
  docId: string,
  input: { decision: "ACCEPT" | "REJECT"; rejectionReason?: string },
) {
  return apiRequest<any>(`/operations/vendor-onboarding/${vendorProfileId}/documents/${docId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function approveOpsVendor(vendorProfileId: string) {
  return apiRequest<any>(`/operations/vendor-onboarding/${vendorProfileId}/approve`, {
    method: "POST",
  });
}

export function rejectOpsVendor(vendorProfileId: string, rejectionReason: string) {
  return apiRequest<any>(`/operations/vendor-onboarding/${vendorProfileId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rejectionReason }),
  });
}

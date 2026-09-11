import { apiDownload, apiRequest, saveBlob } from "./client";

export interface CaseApproval {
  caseStatus: string;
  caseVersion: number;
  canApprove: boolean;
  legacyApprovalRequired: boolean;
  latestQa: {
    id: string;
    decision: string;
    notes: string | null;
    reviewerName: string;
    createdAt: string;
  } | null;
  reviews: Array<{
    id: string;
    decision: string;
    notes: string;
    reviewerName: string;
    createdAt: string;
  }>;
}

export function getCaseApproval(caseId: string) {
  return apiRequest<CaseApproval>(`/cases/${caseId}/approval`);
}

export function submitManagerReview(
  caseId: string,
  input: {
    caseVersion: number;
    decision: "APPROVED" | "REWORK";
    notes: string;
    recommendation?: string;
    highRiskAcknowledged?: boolean;
  },
) {
  return apiRequest<{ id: string; caseStatus: string; caseVersion: number; reportId?: string }>(
    `/cases/${caseId}/manager-review`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function reopenCase(
  caseId: string,
  input: { caseVersion: number; notes: string; checkIds: string[] },
) {
  return apiRequest<{ caseStatus: string; caseVersion: number }>(`/cases/${caseId}/reopen`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function releaseReport(caseId: string, reportId: string) {
  return apiRequest<{ id: string; status: string }>(
    `/cases/${caseId}/reports/${reportId}/release`,
    { method: "POST" },
  );
}

export async function previewReport(reportId: string, caseNumber: string) {
  saveBlob(
    await apiDownload(`/reports/${reportId}/preview`),
    `Sapling-internal-review-${caseNumber}.pdf`,
  );
}

export function renewReportAccess(reportId: string) {
  return apiRequest<{ id: string; downloadExpiresAt: string }>(
    `/reports/${reportId}/download-access`,
    { method: "POST" },
  );
}

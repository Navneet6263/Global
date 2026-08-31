import { apiDownload, apiRequest, saveBlob } from "./client";

export interface ReportSummary {
  id: string;
  status: string;
  currentVersion: number;
  publishedAt?: string | null;
  createdAt: string;
  versions: Array<{
    version: number;
    sha256: string;
    authenticityCode: string;
    generatedAt: string;
  }>;
}

export interface PublishedReportSummary {
  id: string;
  status: string;
  currentVersion: number;
  publishedAt?: string | null;
  case: {
    id: string;
    caseNumber: string;
    completedAt?: string | null;
    subject: { fullName: string };
  };
  latestVersion: {
    version: number;
    authenticityCode: string;
    sha256: string;
    generatedAt: string;
  } | null;
}

export function listPublishedReports(
  input: {
    search?: string;
    cursor?: string;
    limit?: number;
  } = {},
) {
  const query = new URLSearchParams({ limit: String(input.limit ?? 20) });
  if (input.search) query.set("search", input.search);
  if (input.cursor) query.set("cursor", input.cursor);
  return apiRequest<{ items: PublishedReportSummary[]; nextCursor: string | null }>(
    `/reports?${query.toString()}`,
  );
}

export function listReports(caseId: string) {
  return apiRequest<{ items: ReportSummary[] }>(`/cases/${caseId}/reports`);
}

export function generateReport(caseId: string) {
  return apiRequest<{
    id: string;
    status: string;
    version: number;
    authenticityCode: string;
    generatedAt: string;
  }>(`/cases/${caseId}/reports/generate`, { method: "POST" });
}

export function retryReport(caseId: string, reportId: string) {
  return apiRequest<{ id: string; status: string }>(`/cases/${caseId}/reports/${reportId}/retry`, {
    method: "POST",
  });
}

export async function downloadReport(reportId: string, caseNumber: string) {
  const blob = await apiDownload(`/reports/${reportId}/content`);
  saveBlob(blob, `Sapling-Global-${caseNumber}.pdf`);
}

export function verifyReport(authenticityCode: string) {
  return apiRequest<{
    valid: boolean;
    caseNumber: string;
    reportVersion: number;
    sha256: string;
    generatedAt: string;
    completedAt?: string | null;
  }>(`/public/reports/verify/${encodeURIComponent(authenticityCode)}`);
}

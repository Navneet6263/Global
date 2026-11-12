import { apiDownload, apiRequest, saveBlob } from "./client";

export type Disposition = "GREEN" | "RED" | "YELLOW" | "AMBER" | "BLUE" | "CLIENT_REVIEW";
export type ReworkMode = "REOPEN" | "REINITIATE" | "REJECT";
export type AnnexurePeriod = "week" | "month" | "year";

export interface UtvItem {
  checkId: string;
  checkType: string;
  reason: string;
  closedAt: string | null;
  verifier: string | null;
  caseId: string;
  caseNumber: string;
  caseStatus: string;
  candidateName: string;
  clientName: string;
  canRework: boolean;
}

export interface AnnexureItem {
  checkId: string;
  caseId: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  checkType: string;
  verifier: string | null;
  completedAt: string | null;
  status: string;
  colour: Disposition | null;
  colourLabel: string;
  canSendBack: boolean;
}

export const getUtvBucket = (params: { page: number; search?: string; departmentId?: string }) => {
  const query = new URLSearchParams({ page: String(params.page), pageSize: "20" });
  if (params.search) query.set("search", params.search);
  if (params.departmentId) query.set("departmentId", params.departmentId);
  return apiRequest<{ items: UtvItem[]; total: number; page: number; pageSize: number }>(
    `/workflow/utv?${query}`,
  );
};

export const reworkCheck = (checkId: string, mode: ReworkMode, reason: string) =>
  apiRequest<{ checkId: string; taskId: string; assigned: boolean }>(
    `/workflow/checks/${checkId}/rework`,
    { method: "POST", body: JSON.stringify({ mode, reason }) },
  );

export const getTeamAnnexure = (period: AnnexurePeriod, departmentId?: string) => {
  const query = new URLSearchParams({ period });
  if (departmentId) query.set("departmentId", departmentId);
  return apiRequest<{
    period: AnnexurePeriod;
    since: string;
    total: number;
    colours: Record<string, number>;
    items: AnnexureItem[];
  }>(`/workflow/team-annexure?${query}`);
};

export async function downloadTeamAnnexure(
  period: AnnexurePeriod,
  columns?: readonly string[],
  departmentId?: string,
) {
  const query = new URLSearchParams({ period });
  if (columns?.length) query.set("columns", columns.join(","));
  if (departmentId) query.set("departmentId", departmentId);
  const blob = await apiDownload(`/workflow/team-annexure/export?${query}`);
  saveBlob(blob, `Sapling-Global-team-annexure-${period}.csv`);
}

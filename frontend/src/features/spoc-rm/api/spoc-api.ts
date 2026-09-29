import { apiRequest } from "@/lib/backend-api/client";
import type {
  SpocActivity,
  SpocCaseDetail,
  SpocCaseRow,
  SpocClientRow,
  SpocDomain,
  SpocExceptions,
  SpocFilterOptions,
  SpocInvoiceRow,
  SpocOpportunityRow,
  SpocOverview,
  SpocOverviewFilters,
  SpocPage,
  SpocQaRow,
  SpocQuery,
  SpocTaskRow,
  SpocVisitRow,
} from "../contracts/spoc";

/** Drops empty values so the backend's strict DTO whitelist never sees blanks. */
export function queryString(query: SpocQuery | SpocOverviewFilters): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== false) params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

const domainPath: Record<SpocDomain, string> = {
  cases: "/spoc/cases",
  tasks: "/spoc/tasks",
  qa: "/spoc/qa",
  visits: "/spoc/field-visits",
  opportunities: "/spoc/opportunities",
  invoices: "/spoc/invoices",
};

export interface SpocDomainRows {
  cases: SpocCaseRow;
  tasks: SpocTaskRow;
  qa: SpocQaRow;
  visits: SpocVisitRow;
  opportunities: SpocOpportunityRow;
  invoices: SpocInvoiceRow;
}

export const spocApi = {
  overview: (filters: SpocOverviewFilters, signal?: AbortSignal) =>
    apiRequest<SpocOverview>(`/spoc/overview${queryString(filters)}`, { signal }),
  filters: (signal?: AbortSignal) => apiRequest<SpocFilterOptions>("/spoc/filters", { signal }),
  exceptions: (query: SpocQuery, signal?: AbortSignal) =>
    apiRequest<SpocExceptions>(`/spoc/exceptions${queryString(query)}`, { signal }),
  clients: (query: SpocQuery, signal?: AbortSignal) =>
    apiRequest<SpocPage<SpocClientRow>>(`/spoc/clients${queryString(query)}`, { signal }),
  records: <D extends SpocDomain>(domain: D, query: SpocQuery, signal?: AbortSignal) =>
    apiRequest<SpocPage<SpocDomainRows[D]>>(`${domainPath[domain]}${queryString(query)}`, {
      signal,
    }),
  caseDetail: (caseId: string, signal?: AbortSignal) =>
    apiRequest<SpocCaseDetail>(`/spoc/cases/${encodeURIComponent(caseId)}`, { signal }),
  caseActivity: (caseId: string, cursor: string | undefined, signal?: AbortSignal) =>
    apiRequest<SpocActivity>(
      `/spoc/cases/${encodeURIComponent(caseId)}/activity${queryString({ cursor, limit: 20 })}`,
      { signal },
    ),
};

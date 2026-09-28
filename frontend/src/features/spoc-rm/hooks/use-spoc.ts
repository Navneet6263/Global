import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { spocApi } from "../api/spoc-api";
import type { SpocDomain, SpocOverviewFilters, SpocQuery } from "../contracts/spoc";

/** All SPOC data lives under ["spoc", …] so it never mixes with role workspaces' caches. */
export const spocKeys = {
  all: ["spoc"] as const,
  overview: (filters: SpocOverviewFilters) => ["spoc", "overview", filters] as const,
  filters: () => ["spoc", "filters"] as const,
  exceptions: (query: SpocQuery) => ["spoc", "exceptions", query] as const,
  clients: (query: SpocQuery) => ["spoc", "clients", query] as const,
  records: (domain: SpocDomain, query: SpocQuery) => ["spoc", "records", domain, query] as const,
  case: (caseId: string) => ["spoc", "case", caseId] as const,
  activity: (caseId: string) => ["spoc", "case", caseId, "activity"] as const,
};

const MONITOR_REFRESH_MS = 60_000;

export function useSpocOverview(filters: SpocOverviewFilters) {
  return useQuery({
    queryKey: spocKeys.overview(filters),
    queryFn: ({ signal }) => spocApi.overview(filters, signal),
    placeholderData: keepPreviousData,
    refetchInterval: MONITOR_REFRESH_MS,
  });
}

export function useSpocFilters() {
  return useQuery({
    queryKey: spocKeys.filters(),
    queryFn: ({ signal }) => spocApi.filters(signal),
    staleTime: 5 * 60_000,
  });
}

export function useSpocExceptions(query: SpocQuery) {
  return useQuery({
    queryKey: spocKeys.exceptions(query),
    queryFn: ({ signal }) => spocApi.exceptions(query, signal),
    placeholderData: keepPreviousData,
    refetchInterval: MONITOR_REFRESH_MS,
  });
}

export function useSpocClients(query: SpocQuery) {
  return useQuery({
    queryKey: spocKeys.clients(query),
    queryFn: ({ signal }) => spocApi.clients(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSpocRecords<D extends SpocDomain>(domain: D, query: SpocQuery) {
  return useQuery({
    queryKey: spocKeys.records(domain, query),
    queryFn: ({ signal }) => spocApi.records(domain, query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSpocCase(caseId: string | undefined) {
  return useQuery({
    queryKey: spocKeys.case(caseId ?? ""),
    queryFn: ({ signal }) => spocApi.caseDetail(caseId!, signal),
    enabled: Boolean(caseId),
  });
}

export function useSpocCaseActivity(caseId: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: spocKeys.activity(caseId ?? ""),
    queryFn: ({ pageParam, signal }) => spocApi.caseActivity(caseId!, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(caseId) && enabled,
  });
}

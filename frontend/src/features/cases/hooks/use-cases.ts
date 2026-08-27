"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { CaseQuery } from "@/lib/contracts/case";

export function useCases(query: CaseQuery) {
  return useQuery({
    queryKey: queryKeys.cases(query),
    queryFn: () => api.cases.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useCaseFacets() {
  return useQuery({
    queryKey: queryKeys.caseFacets(),
    queryFn: () => api.cases.facets(),
    staleTime: 300_000,
  });
}

export function useCaseDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.caseById(id ?? "none"),
    queryFn: () => api.cases.getById(id as string),
    enabled: Boolean(id),
  });
}

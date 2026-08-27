"use client";

import { useQuery, queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export const controlTowerQueryOptions = queryOptions({
  queryKey: queryKeys.controlTower(),
  queryFn: () => api.dashboard.getControlTower(),
  staleTime: 30_000,
});

export function useControlTower() {
  return useQuery(controlTowerQueryOptions);
}

export function usePlatformHealth() {
  return useQuery({
    queryKey: queryKeys.platformHealth(),
    queryFn: () => api.dashboard.getPlatformHealth(),
    staleTime: 60_000,
  });
}

"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ClientDraft, ClientQuery } from "@/lib/contracts/client";

export function useClients(query: ClientQuery) {
  return useQuery({
    queryKey: queryKeys.clients(query),
    queryFn: () => api.clients.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: ClientDraft) => api.clients.create(draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useSetClientStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: "active" | "suspended" }) =>
      api.clients.setStatus(input.id, input.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { vendorApi } from "./vendor-api";
import type { VendorDecisionInput, VendorRequestQuery } from "./vendor-contracts";

export const vendorKeys = {
  all: ["vendor"] as const,
  list: (query: VendorRequestQuery) => ["vendor", "requests", query] as const,
  detail: (requestId: string) => ["vendor", "request", requestId] as const,
};

export function useVendorRequests(query: VendorRequestQuery) {
  return useQuery({
    queryKey: vendorKeys.list(query),
    queryFn: ({ signal }) => vendorApi.list(query, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useVendorRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: vendorKeys.detail(requestId ?? ""),
    queryFn: ({ signal }) => vendorApi.detail(requestId!, signal),
    enabled: Boolean(requestId),
  });
}

export function useVendorDecision(onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VendorDecisionInput) => vendorApi.decide(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: vendorKeys.all });
      toast.success(result.status === "APPROVED" ? "Document approved" : "Document rejected", {
        description: "The SPOC-RM team has been notified.",
      });
      onDone();
    },
    onError: (error: Error) =>
      toast.error("The decision was not saved", { description: error.message }),
  });
}

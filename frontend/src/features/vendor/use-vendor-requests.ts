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

export function useDelegateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { requestId: string; handlerId: string | null; version: number }) =>
      vendorApi.delegate(input.requestId, input.handlerId, input.version),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: vendorKeys.all });
      toast.success(result.handler ? `Assigned to ${result.handler.name}` : "You are handling it", {
        description: result.handler ? "They have been notified." : undefined,
      });
    },
    onError: (error: Error) => toast.error("Not reassigned", { description: error.message }),
  });
}

export function useRemindRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => vendorApi.remind(requestId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: vendorKeys.all });
      toast.success(`Reminder sent to ${result.handler}`);
    },
    onError: (error: Error) => toast.error("Reminder not sent", { description: error.message }),
  });
}

export function useUploadReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { requestId: string; file: File }) =>
      vendorApi.uploadReport(input.requestId, input.file),
    onSuccess: (report) => {
      void queryClient.invalidateQueries({ queryKey: vendorKeys.all });
      toast.success(`Report v${report.version} uploaded`, {
        description: "SPOC-RM has been notified that it is available.",
      });
    },
    onError: (error: Error) => toast.error("Report not uploaded", { description: error.message }),
  });
}

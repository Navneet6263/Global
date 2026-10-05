import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clientSupportApi, supportApi } from "../api/support-api";
import type {
  RaiseSupportRequestInput,
  SupportEmployeeQuery,
  SupportRequestQuery,
  UpdateSupportRequestInput,
} from "../api/support-contracts";

export const supportKeys = {
  all: ["support"] as const,
  summary: () => ["support", "summary"] as const,
  clients: (query: object) => ["support", "clients", query] as const,
  employees: (query: SupportEmployeeQuery) => ["support", "employees", query] as const,
  employee: (caseId: string) => ["support", "employee", caseId] as const,
  requests: (query: SupportRequestQuery) => ["support", "requests", query] as const,
  request: (requestId: string) => ["support", "request", requestId] as const,
  mine: (page: number) => ["support", "mine", page] as const,
};

export function useSupportSummary() {
  return useQuery({
    queryKey: supportKeys.summary(),
    queryFn: ({ signal }) => supportApi.summary(signal),
  });
}

export function useSupportClients(query: { page: number; pageSize: number; search?: string }) {
  return useQuery({
    queryKey: supportKeys.clients(query),
    queryFn: ({ signal }) => supportApi.clients(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSupportEmployees(query: SupportEmployeeQuery) {
  return useQuery({
    queryKey: supportKeys.employees(query),
    queryFn: ({ signal }) => supportApi.employees(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSupportEmployee(caseId: string | undefined) {
  return useQuery({
    queryKey: supportKeys.employee(caseId ?? ""),
    queryFn: ({ signal }) => supportApi.employee(caseId!, signal),
    enabled: Boolean(caseId),
  });
}

export function useSupportRequests(query: SupportRequestQuery) {
  return useQuery({
    queryKey: supportKeys.requests(query),
    queryFn: ({ signal }) => supportApi.requests(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSupportRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: supportKeys.request(requestId ?? ""),
    queryFn: ({ signal }) => supportApi.request(requestId!, signal),
    enabled: Boolean(requestId),
  });
}

export function useUpdateSupportRequest(onSaved?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSupportRequestInput) => supportApi.update(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.all });
      toast.success(
        result.status === "RESOLVED" ? "Request resolved" : "Request marked in progress",
        {
          description:
            result.requesterType === "CLIENT_ADMIN"
              ? "The Client Admin has been notified."
              : "The candidate sees this on their link.",
        },
      );
      onSaved?.();
    },
    onError: (error: Error) =>
      toast.error("The request was not updated", { description: error.message }),
  });
}

export function useMySupportRequests(page: number, enabled: boolean, pageSize = 10) {
  return useQuery({
    queryKey: [...supportKeys.mine(page), pageSize],
    queryFn: ({ signal }) => clientSupportApi.mine(page, signal, pageSize),
    enabled,
  });
}

export function useRaiseSupportRequest(onSaved?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RaiseSupportRequestInput) => clientSupportApi.raise(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["support", "mine"] });
      toast.success("Support request sent", {
        description: `${result.requestNumber} is with the support team.`,
      });
      onSaved?.();
    },
    onError: (error: Error) =>
      toast.error("The request was not sent", { description: error.message }),
  });
}

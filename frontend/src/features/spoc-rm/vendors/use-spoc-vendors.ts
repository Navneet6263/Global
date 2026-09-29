import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SpocQuery } from "../contracts/spoc";
import { spocVendorApi } from "./spoc-vendor-api";
import type { AssignVendorInput, RequestReuploadInput } from "./spoc-vendor-contracts";

/** Kept under ["spoc", "vendors", …] so every SPOC cache stays in one namespace. */
export const spocVendorKeys = {
  all: ["spoc", "vendors"] as const,
  clients: (query: SpocQuery) => ["spoc", "vendors", "clients", query] as const,
  documents: (clientId: string, query: SpocQuery) =>
    ["spoc", "vendors", "documents", clientId, query] as const,
  document: (documentId: string) => ["spoc", "vendors", "document", documentId] as const,
  vendors: () => ["spoc", "vendors", "options"] as const,
};

export function useSpocVendorClients(query: SpocQuery) {
  return useQuery({
    queryKey: spocVendorKeys.clients(query),
    queryFn: ({ signal }) => spocVendorApi.clients(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSpocVendorDocuments(clientId: string | undefined, query: SpocQuery) {
  return useQuery({
    queryKey: spocVendorKeys.documents(clientId ?? "", query),
    queryFn: ({ signal }) => spocVendorApi.documents(clientId!, query, signal),
    enabled: Boolean(clientId),
    placeholderData: keepPreviousData,
  });
}

export function useSpocVendorDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: spocVendorKeys.document(documentId ?? ""),
    queryFn: ({ signal }) => spocVendorApi.document(documentId!, signal),
    enabled: Boolean(documentId),
  });
}

export function useVendorOptions(enabled: boolean) {
  return useQuery({
    queryKey: spocVendorKeys.vendors(),
    queryFn: ({ signal }) => spocVendorApi.vendors(signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useSaveVendorAssignment(onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignVendorInput) => spocVendorApi.save(input),
    onSuccess: (result, input) => {
      void queryClient.invalidateQueries({ queryKey: spocVendorKeys.all });
      toast.success(input.mode === "assign" ? "Vendor assigned" : "Vendor re-assigned", {
        description: `${result.vendor.name} has been notified.`,
      });
      onSaved();
    },
    onError: (error: Error) =>
      toast.error("The assignment was not saved", { description: error.message }),
  });
}

export function useRequestReupload(onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestReuploadInput) => spocVendorApi.requestReupload(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: spocVendorKeys.all });
      toast.success("Sent back to the candidate", {
        description: result.candidateMessage
          ? `The candidate was told by ${result.candidateMessage === "EMAIL" ? "email" : "SMS"} to re-upload on their existing link.`
          : "The candidate sees the request next time they open their link.",
      });
      onSaved();
    },
    onError: (error: Error) =>
      toast.error("The re-upload request was not sent", { description: error.message }),
  });
}

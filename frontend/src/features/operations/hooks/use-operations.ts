import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { OpsCaseQuery } from "../contracts/case";
import type {
  AssignInput,
  CaseActionInput,
  ClarificationActionInput,
  ClarificationQuery,
  OpsExceptionQuery,
  SlaQuery,
} from "../contracts/operations";
import { operationsApi } from "@/lib/data-source/operations";

export const opsKeys = {
  all: ["operations"] as const,
  dashboard: () => [...opsKeys.all, "dashboard"] as const,
  facets: () => [...opsKeys.all, "facets"] as const,
  cases: (query: OpsCaseQuery) => [...opsKeys.all, "cases", query] as const,
  case: (id: string) => [...opsKeys.all, "case", id] as const,
  assignments: () => [...opsKeys.all, "assignments"] as const,
  exceptions: (query: OpsExceptionQuery) => [...opsKeys.all, "exceptions", query] as const,
  sla: (query: SlaQuery) => [...opsKeys.all, "sla", query] as const,
  team: () => [...opsKeys.all, "team"] as const,
  field: () => [...opsKeys.all, "field"] as const,
  clarifications: (query: ClarificationQuery) => [...opsKeys.all, "clarifications", query] as const,
  notifications: () => [...opsKeys.all, "notifications"] as const,
};

export const opsDashboardQueryOptions = queryOptions({
  queryKey: opsKeys.dashboard(),
  queryFn: () => operationsApi.getDashboard(),
  staleTime: 30_000,
});

export function useOpsDashboard() {
  return useQuery(opsDashboardQueryOptions);
}

export function useOpsFacets() {
  return useQuery({ queryKey: opsKeys.facets(), queryFn: () => operationsApi.getFacets() });
}

export function useOpsCases(query: OpsCaseQuery) {
  return useQuery({ queryKey: opsKeys.cases(query), queryFn: () => operationsApi.getCases(query) });
}

export function useOpsCase(caseId: string | undefined) {
  return useQuery({
    queryKey: opsKeys.case(caseId ?? "none"),
    queryFn: () => operationsApi.getCase(caseId!),
    enabled: Boolean(caseId),
  });
}

export function useOpsAssignments() {
  return useQuery({
    queryKey: opsKeys.assignments(),
    queryFn: () => operationsApi.getAssignments(),
  });
}

export function useOpsExceptions(query: OpsExceptionQuery) {
  return useQuery({
    queryKey: opsKeys.exceptions(query),
    queryFn: () => operationsApi.getExceptions(query),
  });
}

export function useOpsSla(query: SlaQuery) {
  return useQuery({
    queryKey: opsKeys.sla(query),
    queryFn: () => operationsApi.getSlaPerformance(query),
  });
}

export function useOpsTeam() {
  return useQuery({ queryKey: opsKeys.team(), queryFn: () => operationsApi.getTeamCapacity() });
}

export function useOpsField() {
  return useQuery({ queryKey: opsKeys.field(), queryFn: () => operationsApi.getFieldOperations() });
}

export function useOpsClarifications(query: ClarificationQuery) {
  return useQuery({
    queryKey: opsKeys.clarifications(query),
    queryFn: () => operationsApi.getClarifications(query),
  });
}

export function useOpsNotifications() {
  return useQuery({
    queryKey: opsKeys.notifications(),
    queryFn: () => operationsApi.getNotifications(),
  });
}

function useOpsInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: opsKeys.all });
  };
}

export function useCaseAction() {
  const invalidate = useOpsInvalidate();
  return useMutation({
    mutationFn: (input: CaseActionInput) => operationsApi.runCaseAction(input),
    onSuccess: (result) => {
      toast.success(result.message);
      invalidate();
    },
    onError: () => toast.error("Action failed. Please retry."),
  });
}

export function useAssignChecks() {
  const invalidate = useOpsInvalidate();
  return useMutation({
    mutationFn: (input: AssignInput) => operationsApi.assignCase(input),
    onSuccess: (result) => {
      toast.success(`${result.assigned} checks assigned to ${result.memberName}`, {
        description: result.warnings.length > 0 ? result.warnings.join(" ") : undefined,
      });
      invalidate();
    },
    onError: () => toast.error("Assignment failed. Please retry."),
  });
}

export function useClarificationAction() {
  const invalidate = useOpsInvalidate();
  return useMutation({
    mutationFn: (input: ClarificationActionInput) => operationsApi.respondToClarification(input),
    onSuccess: (result) => {
      toast.success(result.message);
      invalidate();
    },
    onError: () => toast.error("Could not update the clarification."),
  });
}

export function useExceptionAction() {
  const invalidate = useOpsInvalidate();
  return useMutation({
    mutationFn: (input: {
      id: string;
      action: "resolve" | "escalate" | "owner";
      value: string;
    }) => {
      if (input.action === "resolve") return operationsApi.resolveException(input.id, input.value);
      if (input.action === "escalate")
        return operationsApi.escalateException(input.id, input.value);
      return operationsApi.assignExceptionOwner(input.id, input.value);
    },
    onSuccess: (_data, input) => {
      toast.success(
        input.action === "resolve"
          ? "Exception resolved"
          : input.action === "escalate"
            ? "Exception escalated"
            : "Owner updated",
      );
      invalidate();
    },
    onError: () => toast.error("Could not update the exception."),
  });
}

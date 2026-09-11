"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmApi } from "@/lib/data-source/crm";
import type {
  AccountQuery,
  ActivityQuery,
  AddActivityInput,
  AssignOwnerInput,
  CreateOpportunityInput,
  FollowUpActionInput,
  FollowUpQuery,
  ForecastQuery,
  OpportunityQuery,
  StageChangeInput,
  UpdateOpportunityInput,
  UpdateCrmSettingsInput,
} from "../contracts/crm";

export const crmKeys = {
  all: ["crm"] as const,
  overview: () => [...crmKeys.all, "overview"] as const,
  adminSummary: () => [...crmKeys.all, "admin-summary"] as const,
  opportunities: (query: OpportunityQuery) => [...crmKeys.all, "opportunities", query] as const,
  opportunity: (id: string) => [...crmKeys.all, "opportunity", id] as const,
  activities: (query: ActivityQuery) => [...crmKeys.all, "activities", query] as const,
  followUps: (query: FollowUpQuery) => [...crmKeys.all, "follow-ups", query] as const,
  accounts: (query: AccountQuery) => [...crmKeys.all, "accounts", query] as const,
  forecast: (query: ForecastQuery) => [...crmKeys.all, "forecast", query] as const,
  owners: () => [...crmKeys.all, "owners"] as const,
  settings: () => [...crmKeys.all, "settings"] as const,
};

export const crmOverviewQueryOptions = queryOptions({
  queryKey: crmKeys.overview(),
  queryFn: () => crmApi.getOverview(),
  staleTime: 30_000,
});

export const crmAdminSummaryQueryOptions = queryOptions({
  queryKey: crmKeys.adminSummary(),
  queryFn: () => crmApi.getAdminSummary(),
  staleTime: 60_000,
});

export function useCrmOverview() {
  return useQuery(crmOverviewQueryOptions);
}

export function useCrmAdminSummary() {
  return useQuery(crmAdminSummaryQueryOptions);
}

export function useOpportunities(query: OpportunityQuery) {
  return useQuery({
    queryKey: crmKeys.opportunities(query),
    queryFn: () => crmApi.getOpportunities(query),
  });
}

export function useOpportunity(opportunityId: string | undefined) {
  return useQuery({
    queryKey: crmKeys.opportunity(opportunityId ?? "none"),
    queryFn: () => crmApi.getOpportunity(opportunityId!),
    enabled: Boolean(opportunityId),
  });
}

export function useSalesActivities(query: ActivityQuery) {
  return useQuery({
    queryKey: crmKeys.activities(query),
    queryFn: () => crmApi.getActivities(query),
  });
}

export function useFollowUps(query: FollowUpQuery) {
  return useQuery({
    queryKey: crmKeys.followUps(query),
    queryFn: () => crmApi.getFollowUps(query),
  });
}

export function useSalesAccounts(query: AccountQuery) {
  return useQuery({ queryKey: crmKeys.accounts(query), queryFn: () => crmApi.getAccounts(query) });
}

export function useRevenueForecast(query: ForecastQuery) {
  return useQuery({ queryKey: crmKeys.forecast(query), queryFn: () => crmApi.getForecast(query) });
}

export function useSalesOwners() {
  return useQuery({ queryKey: crmKeys.owners(), queryFn: () => crmApi.getSalesOwners() });
}

export function useCrmSettings() {
  return useQuery({
    queryKey: crmKeys.settings(),
    queryFn: () => crmApi.getSettings(),
    staleTime: 60_000,
  });
}

function useCrmMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  success: (result: TResult, input: TInput) => { title: string; description?: string },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, input) => {
      const message = success(result, input);
      toast.success(message.title, { description: message.description });
      void queryClient.invalidateQueries({ queryKey: crmKeys.all });
    },
    onError: (error: Error) => {
      toast.error("Action could not be completed", { description: error.message });
    },
  });
}

export function useCreateOpportunity() {
  return useCrmMutation<
    CreateOpportunityInput,
    Awaited<ReturnType<typeof crmApi.createOpportunity>>
  >(
    (input) => crmApi.createOpportunity(input),
    (result) => ({
      title: "Opportunity created",
      description: `${result.company} added to New stage.`,
    }),
  );
}

export function useUpdateOpportunity() {
  return useCrmMutation<{ id: string; input: UpdateOpportunityInput }, unknown>(
    ({ id, input }) => crmApi.updateOpportunity(id, input),
    () => ({ title: "Opportunity updated" }),
  );
}

export function useChangeStage() {
  return useCrmMutation<StageChangeInput, unknown>(
    (input) => crmApi.changeOpportunityStage(input),
    (_result, input) => ({
      title: `Stage moved to ${input.stage}`,
      description: "Pipeline metrics and forecast recalculated.",
    }),
  );
}

export function useAssignOwner() {
  return useCrmMutation<AssignOwnerInput, unknown>(
    (input) => crmApi.assignOwner(input),
    () => ({ title: "Owner updated" }),
  );
}

export function usePrepareOnboarding() {
  return useCrmMutation<string, unknown>(
    (id) => crmApi.prepareOnboarding(id),
    () => ({
      title: "Client workspace linked",
      description:
        "Complete the client's commercial settings and activate it from Client Management.",
    }),
  );
}

export function useAddActivity() {
  return useCrmMutation<AddActivityInput, unknown>(
    (input) => crmApi.addActivity(input),
    () => ({ title: "Activity logged" }),
  );
}

export function useCompleteFollowUp() {
  return useCrmMutation<FollowUpActionInput, unknown>(
    (input) => crmApi.completeFollowUp(input),
    () => ({ title: "Follow-up completed" }),
  );
}

export function useRescheduleFollowUp() {
  return useCrmMutation<FollowUpActionInput, unknown>(
    (input) => crmApi.rescheduleFollowUp(input),
    () => ({ title: "Follow-up rescheduled" }),
  );
}

export function useUpdateCrmSettings() {
  return useCrmMutation<UpdateCrmSettingsInput, Awaited<ReturnType<typeof crmApi.updateSettings>>>(
    (input) => crmApi.updateSettings(input),
    () => ({
      title: "CRM settings saved",
      description: "Pipeline defaults and lead sources are now active for this workspace.",
    }),
  );
}

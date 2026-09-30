import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { vendorKeys } from "../use-vendor-requests";
import { vendorTeamApi } from "./vendor-team-api";
import type { CreateTeamUserInput, TeamMemberStatus } from "./vendor-team-contracts";

const teamKey = ["vendor", "team"] as const;

export function useVendorTeam(enabled = true) {
  return useQuery({
    queryKey: teamKey,
    queryFn: ({ signal }) => vendorTeamApi.overview(signal),
    enabled,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: teamKey });
    void queryClient.invalidateQueries({ queryKey: vendorKeys.all });
  };
}

export function useCreateTeamUser() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: CreateTeamUserInput) => vendorTeamApi.create(input),
    onSuccess: refresh,
  });
}

export function useSetTeamUserStatus() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { id: string; status: TeamMemberStatus; version: number }) =>
      vendorTeamApi.setStatus(input.id, input.status, input.version),
    onSuccess: (result) => {
      refresh();
      toast.success(
        result.status === "SUSPENDED" ? "Team user suspended" : "Team user reactivated",
        {
          description:
            result.requestsReturned > 0
              ? `${result.requestsReturned} pending request(s) came back to you.`
              : undefined,
        },
      );
    },
    onError: (error: Error) => toast.error("Status not changed", { description: error.message }),
  });
}

export function useResetTeamPassword() {
  return useMutation({ mutationFn: (id: string) => vendorTeamApi.resetPassword(id) });
}

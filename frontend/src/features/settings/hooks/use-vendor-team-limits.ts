import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listVendorTeamLimits, updateVendorTeamLimit } from "@/lib/backend-api/settings";

const key = ["settings", "vendor-team-limits"] as const;

/** Main Vendors with their Admin-set team limit and current ACTIVE team size. */
export function useVendorTeamLimits() {
  return useQuery({ queryKey: key, queryFn: listVendorTeamLimits, staleTime: 30_000 });
}

export function useUpdateVendorTeamLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { vendorId: string; maxActiveUsers: number; version: number }) =>
      updateVendorTeamLimit(input.vendorId, {
        maxActiveUsers: input.maxActiveUsers,
        version: input.version,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Vendor team limit saved", {
        description: `Up to ${result.limit} active team user${result.limit === 1 ? "" : "s"}. The change is audited.`,
      });
    },
    onError: (error: Error) => toast.error("Limit not saved", { description: error.message }),
  });
}

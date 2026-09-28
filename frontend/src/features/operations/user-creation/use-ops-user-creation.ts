import { useQuery } from "@tanstack/react-query";
import { getUserCreationPolicy } from "@/lib/backend-api/users";

/** Server-owned creation policy for the signed-in Ops Manager (toggle, roles, branches). */
export function useOpsUserCreationPolicy() {
  return useQuery({
    queryKey: ["users", "creation-policy"],
    queryFn: getUserCreationPolicy,
    staleTime: 30_000,
  });
}

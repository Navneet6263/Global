import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/backend-api/client";

export interface ClientRelationshipManager {
  rm: { name: string; email: string; phone: string | null; since: string | null } | null;
}

/** The company's RM, read live; shared by the header and the dashboard card. */
export function useClientRm(enabled = true) {
  return useQuery({
    queryKey: ["client-account", "relationship-manager"],
    queryFn: () => apiRequest<ClientRelationshipManager>("/client-account/relationship-manager"),
    staleTime: 60_000,
    enabled,
  });
}

export const rmInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

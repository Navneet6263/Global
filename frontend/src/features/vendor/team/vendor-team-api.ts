import { apiRequest } from "@/lib/backend-api/client";
import { toIndianMobileE164 } from "@/lib/indian-mobile";
import { temporaryPassword } from "@/lib/auth/temporary-password";
import type {
  CreateTeamUserInput,
  TeamMemberStatus,
  VendorTeamOverview,
} from "./vendor-team-contracts";

const id = (value: string) => encodeURIComponent(value);

/**
 * Vendor team API (/vendor/team). The server decides who may manage the team and
 * enforces the Admin limit; the one-time password is generated here and shown once.
 */
export const vendorTeamApi = {
  overview: (signal?: AbortSignal) => apiRequest<VendorTeamOverview>("/vendor/team", { signal }),
  create: async (input: CreateTeamUserInput) => {
    const password = temporaryPassword();
    const user = await apiRequest<{ id: string; email: string; displayName: string }>(
      "/vendor/team/users",
      {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          displayName: input.fullName,
          phone: toIndianMobileE164(input.mobile),
          temporaryPassword: password,
        }),
      },
    );
    return { user, temporaryPassword: password };
  },
  setStatus: (memberId: string, status: TeamMemberStatus, version: number) =>
    apiRequest<{ id: string; status: TeamMemberStatus; requestsReturned: number }>(
      `/vendor/team/users/${id(memberId)}/status`,
      { method: "PATCH", body: JSON.stringify({ status, version }) },
    ),
  resetPassword: async (memberId: string) => {
    const password = temporaryPassword();
    await apiRequest<{ reset: true }>(`/vendor/team/users/${id(memberId)}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ temporaryPassword: password }),
    });
    return { temporaryPassword: password };
  },
};

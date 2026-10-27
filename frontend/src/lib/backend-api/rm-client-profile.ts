import { apiRequest } from "./client";

export interface RmClientProfile {
  company: {
    id: string;
    code: string;
    legalName: string;
    name: string;
    status: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    gstin: string | null;
    billingAddress: string | null;
    slaHours: number;
    createdAt: string;
    source: "SELF_SIGNUP" | "ADDED_BY_SAPLING";
    rm: { name: string; since: string | null } | null;
  };
  numbers: { openCases: number; overdueCases: number; completedCases: number };
  packages: {
    /** True when the company has an agreed package list; otherwise every active package. */
    agreement: boolean;
    items: Array<{ id: string; name: string; price: number | null; discountPercent: number }>;
  };
  users: Array<{
    id: string;
    displayName: string;
    email: string;
    phone: string | null;
    status: string;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  }>;
}

/** A company's profile for its RM (My clients). */
export const getRmClientProfile = (clientId: string) =>
  apiRequest<RmClientProfile>(`/rm/clients/${clientId}/profile`);

/** The RM resets a Client Admin login of its company; the server emails the password. */
export const resetRmClientAdminPassword = (
  clientId: string,
  userId: string,
  temporaryPassword: string,
) =>
  apiRequest<{ reset: true; emailed?: boolean }>(
    `/rm/clients/${clientId}/users/${userId}/reset-password`,
    { method: "POST", body: JSON.stringify({ temporaryPassword }) },
  );

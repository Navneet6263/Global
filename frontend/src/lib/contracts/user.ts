import type { Role } from "@/config/roles";

export type UserStatus = "active" | "suspended" | "invited";

export interface PlatformUser {
  id: string;
  version?: number;
  employeeId: string | null;
  fullName: string;
  email: string;
  mobile: string | null;
  roles: readonly Role[];
  status: UserStatus;
  branchScope: readonly string[];
  clientWorkspaceScope: readonly string[];
  /** SPOC-RM only: the assigned client IDs, used to pre-tick Edit role access. */
  clientWorkspaceIds?: readonly string[];
  lastLoginAt: string | null;
  createdAt: string;
  mfaEnabled: boolean | null;
}

export interface UserQuery {
  search?: string;
  role?: Role | "all";
  status?: UserStatus | "all";
  page?: number;
  pageSize?: number;
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  mobile?: string;
  roles: readonly Role[];
  branchId?: string;
  branchLabel?: string;
  clientId?: string;
  clientLabel?: string;
  /** SPOC-RM only: every selected client workspace. */
  clientIds?: readonly string[];
  clientLabels?: readonly string[];
  additionalAccessConfirmed?: boolean;
}

export interface CreatedUserResult {
  user: PlatformUser;
  temporaryPassword: string;
}

import type { Role } from "@/config/roles";

export type UserStatus = "active" | "suspended" | "invited";

export interface PlatformUser {
  id: string;
  employeeId: string | null;
  fullName: string;
  email: string;
  mobile: string | null;
  roles: readonly Role[];
  status: UserStatus;
  branchScope: readonly string[];
  clientWorkspaceScope: readonly string[];
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
}

export interface CreatedUserResult {
  user: PlatformUser;
  temporaryPassword: string;
}

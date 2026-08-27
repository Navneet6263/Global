import type { Role } from "@/config/roles";

export type UserStatus = "active" | "suspended" | "invited";

export interface PlatformUser {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  mobile: string | null;
  roles: readonly Role[];
  status: UserStatus;
  branchScope: readonly string[];
  clientWorkspaceScope: readonly string[];
  lastLoginAt: string | null;
  createdAt: string;
  mfaEnabled: boolean;
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
  branchScope: readonly string[];
  clientWorkspaceScope: readonly string[];
}

export interface CreatedUserResult {
  user: PlatformUser;
  temporaryPassword: string;
}

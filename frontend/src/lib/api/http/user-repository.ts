import type { UserRepository } from "../repositories";
import type { Role } from "@/config/roles";
import {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
  type DirectoryUser,
} from "@/lib/backend-api/users";
import type { PlatformUser } from "@/lib/contracts/user";
import { temporaryPassword } from "@/lib/auth/temporary-password";

export function mapUser(row: DirectoryUser): PlatformUser & { version: number } {
  return {
    id: row.id,
    version: row.version,
    employeeId: null,
    fullName: row.displayName,
    email: row.email,
    mobile: row.phone ?? null,
    roles: row.roles.map((role) => role.code as Role),
    status:
      row.status === "SUSPENDED" ? "suspended" : row.mustChangePassword ? "invited" : "active",
    branchScope: row.branch ? [row.branch.name] : ["All branches"],
    clientWorkspaceScope: row.spocClients?.length
      ? row.spocClients.map((client) => client.displayName)
      : row.client
        ? [row.client.displayName]
        : [],
    clientWorkspaceIds: row.spocClients?.map((client) => client.id) ?? [],
    vendorTeamOf: row.vendorTeamOf ?? null,
    lastLoginAt: row.lastLoginAt ?? null,
    createdAt: row.createdAt,
    mfaEnabled: null,
  };
}

let knownUsers: Array<PlatformUser & { version: number }> = [];

export const userRepository: UserRepository = {
  async list(query) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const response = await listUsers({
      search: query.search?.trim() || undefined,
      role: query.role === "all" ? undefined : query.role,
      status: directoryStatus(query.status),
      page,
      pageSize,
    });
    knownUsers = response.items.map(mapUser);
    return {
      rows: knownUsers,
      total: response.total,
      page: response.page,
      pageSize: response.pageSize,
    };
  },
  async create(input) {
    const password = temporaryPassword();
    const result = await createUser({
      email: input.email,
      displayName: input.fullName,
      phone: input.mobile,
      branchId: input.branchId,
      clientId: input.clientId,
      spocClientIds: input.clientIds?.length ? [...input.clientIds] : undefined,
      roleCodes: [...input.roles],
      additionalAccessConfirmed: input.additionalAccessConfirmed,
      departments: input.departments?.length ? [...input.departments] : undefined,
      access: input.access?.length
        ? input.access.map((entry) => ({ role: entry.role, permissions: [...entry.permissions] }))
        : undefined,
      temporaryPassword: password,
    });
    const user: PlatformUser = {
      id: result.id,
      employeeId: null,
      fullName: result.displayName,
      email: result.email,
      mobile: input.mobile ?? null,
      roles: input.roles,
      status: result.mustChangePassword ? "invited" : "active",
      branchScope: input.branchLabel ? [input.branchLabel] : ["All branches"],
      clientWorkspaceScope: input.clientLabels?.length
        ? [...input.clientLabels]
        : input.clientLabel
          ? [input.clientLabel]
          : [],
      clientWorkspaceIds: input.clientIds ? [...input.clientIds] : [],
      lastLoginAt: null,
      createdAt: result.createdAt,
      mfaEnabled: null,
    };
    return { user, temporaryPassword: password };
  },
  async setStatus(id, status) {
    const current = knownUsers.find((row) => row.id === id);
    if (!current) throw new Error("Refresh the user directory and try again");
    await updateUser(id, {
      version: current.version,
      status: status === "active" ? "ACTIVE" : "SUSPENDED",
    });
    return { ...current, status, version: current.version + 1 };
  },
  async resetPassword(id) {
    const password = temporaryPassword();
    await resetUserPassword(id, password);
    return { temporaryPassword: password };
  },
};

function directoryStatus(status: import("@/lib/contracts/user").UserStatus | "all" | undefined) {
  if (!status || status === "all") return undefined;
  return {
    active: "ACTIVE",
    suspended: "SUSPENDED",
    invited: "INVITED",
  }[status] as "ACTIVE" | "SUSPENDED" | "INVITED";
}

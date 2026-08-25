import { apiRequest } from "./client";

export interface DirectoryUser {
  id: string;
  displayName: string;
  email: string;
  phone?: string | null;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  version: number;
  branch?: { publicId: string; code: string; name: string } | null;
  client?: { publicId: string; displayName: string } | null;
  roles: Array<{ code: string; name: string }>;
}

export interface DirectoryRole {
  id: string;
  code: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
}

export function listRoles() {
  return apiRequest<{ items: DirectoryRole[] }>("/users/roles");
}

export function createUser(input: {
  email: string;
  displayName: string;
  phone?: string;
  branchId?: string;
  clientId?: string;
  roleCodes: string[];
  temporaryPassword: string;
}) {
  return apiRequest<{ id: string }>("/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateUser(
  userId: string,
  input: { version: number; status?: "ACTIVE" | "SUSPENDED"; roleCodes?: string[] },
) {
  return apiRequest<{ id: string; version: number }>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function resetUserPassword(userId: string, temporaryPassword: string) {
  return apiRequest<{ reset: true }>(`/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ temporaryPassword }),
  });
}

export function listUsers(role?: string) {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  return apiRequest<{ items: DirectoryUser[] }>(`/users${query}`);
}

export function getUserActivity(userId: string) {
  return apiRequest<{
    items: Array<{
      id: string;
      action: string;
      ipAddress?: string | null;
      afterJson?: string | null;
      createdAt: string;
      actor?: { displayName: string } | null;
    }>;
  }>(`/users/${userId}/activity`);
}

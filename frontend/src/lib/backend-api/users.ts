import { apiRequest } from "./client";
import { toIndianMobileE164 } from "@/lib/indian-mobile";

export interface DirectoryUser {
  id: string;
  displayName: string;
  email: string;
  phone?: string | null;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
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
  additionalAccessConfirmed?: boolean;
  temporaryPassword: string;
}) {
  const phone = toIndianMobileE164(input.phone);
  return apiRequest<{
    id: string;
    email: string;
    displayName: string;
    status: string;
    mustChangePassword: boolean;
    version: number;
    createdAt: string;
    roles: string[];
  }>("/users", {
    method: "POST",
    body: JSON.stringify({ ...input, phone }),
  });
}

export function updateUser(
  userId: string,
  input: {
    version: number;
    status?: "ACTIVE" | "SUSPENDED";
    roleCodes?: string[];
    additionalAccessConfirmed?: boolean;
  },
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

export interface UserDirectoryInput {
  search?: string;
  role?: string;
  status?: "ACTIVE" | "SUSPENDED" | "INVITED";
  page?: number;
  pageSize?: number;
}

export interface UserDirectoryResponse {
  items: DirectoryUser[];
  total: number;
  page: number;
  pageSize: number;
}

export function listUsers(input: UserDirectoryInput = {}) {
  const query = new URLSearchParams();
  if (input.search) query.set("search", input.search);
  if (input.role) query.set("role", input.role);
  if (input.status) query.set("status", input.status);
  query.set("page", String(input.page ?? 1));
  query.set("pageSize", String(input.pageSize ?? 10));
  return apiRequest<UserDirectoryResponse>(`/users?${query.toString()}`);
}

export async function listAllUsers(role?: string) {
  const items: DirectoryUser[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total) {
    const response = await listUsers({ role, page, pageSize: 100 });
    items.push(...response.items);
    total = response.total;
    if (!response.items.length) break;
    page += 1;
  }
  return { items, total: Number.isFinite(total) ? total : items.length };
}

export interface UserActivityEvent {
  id: string;
  action: string;
  resourceType: string;
  resourcePublicId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  locationLabel?: string | null;
  beforeJson?: string | null;
  afterJson?: string | null;
  createdAt: string;
  actor?: { displayName: string; email: string } | null;
}

export interface UserActivityResponse {
  user: { id: string; displayName: string; email: string };
  items: UserActivityEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export function getUserActivity(userId: string, input: { page?: number; pageSize?: number } = {}) {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 10),
  });
  return apiRequest<UserActivityResponse>(`/users/${userId}/activity?${query.toString()}`);
}

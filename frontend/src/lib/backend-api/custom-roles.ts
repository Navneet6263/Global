import { apiRequest } from "./client";

export interface RoleBase {
  code: string;
  name: string;
  permissions: string[];
}

export interface CustomRole {
  id: string;
  code: string;
  name: string;
  baseRoleCode: string;
  permissions: string[];
  users: number;
  updatedAt: string;
}

export const listCustomRoles = () =>
  apiRequest<{ bases: RoleBase[]; items: CustomRole[] }>("/roles/custom");

export const createCustomRole = (input: {
  name: string;
  baseRoleCode: string;
  permissions: string[];
}) =>
  apiRequest<{ id: string; code: string }>("/roles/custom", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateCustomRole = (id: string, input: { name?: string; permissions?: string[] }) =>
  apiRequest<{ id: string }>(`/roles/custom/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deleteCustomRole = (id: string) =>
  apiRequest<{ id: string; deleted: true }>(`/roles/custom/${id}`, { method: "DELETE" });

export const listCustomRoleMembers = (id: string) =>
  apiRequest<{
    items: Array<{ id: string; displayName: string; email: string; assigned: boolean }>;
  }>(`/roles/custom/${id}/members`);

export const setCustomRoleMember = (id: string, userId: string, assigned: boolean) =>
  apiRequest<{ userId: string; assigned: boolean }>(`/roles/custom/${id}/members/${userId}`, {
    method: "POST",
    body: JSON.stringify({ assigned }),
  });

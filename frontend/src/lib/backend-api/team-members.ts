import { apiRequest } from "./client";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  version: number;
  lastLoginAt: string | null;
  createdAt: string;
  teamRole: "LEAD" | "MEMBER";
  team: { id: string; name: string };
  roles: string[];
  customAccess: boolean;
  openWork: number;
  doneThisWeek: number;
  isYou: boolean;
  canManage: boolean;
}

export interface TeamMembersOverview {
  teams: Array<{ id: string; name: string; kind: string; memberRole: "VERIFIER" | "DATA_ENTRY" }>;
  roles: Array<{ code: string; name: string; permissions: string[] }>;
  members: TeamMember[];
  generatedAt: string;
}

const base = "/workflow/team/members";

export const getTeamMembers = (signal?: AbortSignal) =>
  apiRequest<TeamMembersOverview>(base, { signal });

export const createTeamMember = (input: {
  displayName: string;
  email: string;
  phone?: string;
  temporaryPassword: string;
  departmentId: string;
  permissions?: string[];
}) =>
  apiRequest<{ id: string; displayName: string; email: string; customAccess: boolean }>(base, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const setTeamMemberStatus = (
  id: string,
  input: { status: "ACTIVE" | "SUSPENDED"; version: number },
) =>
  apiRequest<{ id: string; status: string; version: number; openWork: number }>(
    `${base}/${id}/status`,
    { method: "PATCH", body: JSON.stringify(input) },
  );

export const resetTeamMemberPassword = (id: string, temporaryPassword: string) =>
  apiRequest<{ reset: boolean }>(`${base}/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ temporaryPassword }),
  });

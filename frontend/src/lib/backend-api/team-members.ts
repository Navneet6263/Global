import { apiDownload, apiRequest, saveBlob } from "./client";
import { openDocumentPreview } from "./document-preview";
import { filesSha256 } from "./file-digest";

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

export interface TeamMemberDocumentItem {
  id: string;
  category: "IDENTITY" | "AGREEMENT";
  slot: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
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

export const createTeamMemberWithDocuments = async (formData: FormData) => {
  const files = [
    ...formData.getAll("identity"),
    ...formData.getAll("agreement"),
  ].filter((entry): entry is File => entry instanceof File);
  const digest = await filesSha256(files);
  return apiRequest<{ id: string; displayName: string; email: string; customAccess: boolean }>(
    `${base}/with-documents`,
    {
      method: "POST",
      headers: { "x-content-sha256": digest },
      body: formData,
    },
  );
};

export const getTeamMemberDocuments = (userId: string) =>
  apiRequest<TeamMemberDocumentItem[]>(`${base}/${encodeURIComponent(userId)}/documents`);

export const previewTeamMemberDocument = (userId: string, docId: string) =>
  openDocumentPreview(() =>
    apiDownload(`${base}/${encodeURIComponent(userId)}/documents/${encodeURIComponent(docId)}/preview`),
  );

export const downloadTeamMemberDocument = async (
  userId: string,
  docId: string,
  filename: string,
) => {
  const blob = await apiDownload(
    `${base}/${encodeURIComponent(userId)}/documents/${encodeURIComponent(docId)}/download`,
  );
  saveBlob(blob, filename);
};

export const setTeamMemberStatus = (
  id: string,
  input: { status: "ACTIVE" | "SUSPENDED"; version: number },
) =>
  apiRequest<{ id: string; status: string; version: number; openWork: number }>(
    `${base}/${id}/status`,
    { method: "PATCH", body: JSON.stringify(input) },
  );

export const resetTeamMemberPassword = (id: string, temporaryPassword: string) =>
  apiRequest<{ reset: boolean; emailed?: boolean }>(`${base}/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ temporaryPassword }),
  });

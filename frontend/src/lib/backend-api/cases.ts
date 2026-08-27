import type { CaseDraft, CheckKey } from "@/features/cases/new-case/model";
import { toIndianMobileE164 } from "@/lib/indian-mobile";
import { apiDownload, apiRequest, saveBlob } from "./client";

export type ClientOption = {
  publicId: string;
  code: string;
  legalName: string;
  displayName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status: string;
  slaHours: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export interface CaseListItem {
  id: string;
  caseNumber: string;
  externalRef?: string | null;
  status: string;
  priority: string;
  dueAt?: string | null;
  completedAt?: string | null;
  riskLevel?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  subject: {
    publicId: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    employeeCode?: string | null;
  };
  client: { publicId: string; code: string; displayName: string };
  checks: Array<{
    publicId: string;
    type: string;
    status: string;
    result?: string | null;
    riskLevel?: string | null;
    dueAt?: string | null;
    completedAt?: string | null;
    sourceSummary?: string | null;
    version?: number;
    tasks?: Array<{
      publicId: string;
      status: string;
      instructions?: string | null;
      dueAt?: string | null;
      version: number;
      assignee?: { publicId: string; displayName: string; email: string } | null;
    }>;
  }>;
}

export interface CaseDetail extends CaseListItem {
  statusHistory: Array<{
    fromStatus?: string | null;
    toStatus: string;
    reason?: string | null;
    createdAt: string;
  }>;
  consents: Array<{
    publicId: string;
    status: string;
    purpose: string;
    noticeVersion: string;
    acceptedAt?: string | null;
    withdrawnAt?: string | null;
    createdAt: string;
  }>;
  documents: Array<{
    publicId: string;
    type: string;
    status: string;
    currentVersion: number;
    expiresAt?: string | null;
    versions: Array<{
      version: number;
      originalName: string;
      contentType: string;
      sizeBytes: string;
      sha256: string;
      malwareState: string;
      createdAt: string;
    }>;
  }>;
  clarifications: Array<{
    publicId: string;
    status: string;
    subject: string;
    dueAt?: string | null;
    resolvedAt?: string | null;
    createdAt: string;
  }>;
  qaReviews: Array<{
    publicId: string;
    decision: string;
    notes?: string | null;
    checklistJson: string;
    createdAt: string;
  }>;
  reports: Array<{
    publicId: string;
    status: string;
    currentVersion: number;
    publishedAt?: string | null;
    createdAt: string;
  }>;
  fieldVisits: Array<{
    publicId: string;
    status: string;
    version: number;
    address: string;
    geofenceMeters: number;
    distanceMeters?: number | null;
    capturedAt?: string | null;
    completedAt?: string | null;
    assignee?: { publicId: string; displayName: string; email: string } | null;
  }>;
}

export function listCases(
  input: {
    search?: string;
    status?: string;
    clientId?: string;
    limit?: number;
    cursor?: string;
  } = {},
) {
  const query = new URLSearchParams();
  if (input.search) query.set("search", input.search);
  if (input.status) query.set("status", input.status);
  if (input.clientId) query.set("clientId", input.clientId);
  if (input.cursor) query.set("cursor", input.cursor);
  query.set("limit", String(input.limit ?? 20));
  return apiRequest<{ items: CaseListItem[]; nextCursor: string | null }>(
    `/cases?${query.toString()}`,
  );
}

export function getCase(caseId: string) {
  return apiRequest<CaseDetail>(`/cases/${caseId}`);
}

export async function exportCases(input: { search?: string; status?: string } = {}) {
  const query = new URLSearchParams();
  if (input.search) query.set("search", input.search);
  if (input.status) query.set("status", input.status);
  const blob = await apiDownload(`/cases/export?${query.toString()}`);
  saveBlob(blob, `sapling-global-cases-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function listClients() {
  return apiRequest<{ items: ClientOption[]; nextCursor: string | null }>("/clients?limit=100");
}

export function createClient(input: {
  code: string;
  legalName: string;
  displayName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  slaHours: number;
}) {
  const contactPhone = toIndianMobileE164(input.contactPhone);
  return apiRequest<ClientOption>("/clients", {
    method: "POST",
    body: JSON.stringify({ ...input, contactPhone }),
  });
}

export function updateClient(
  clientId: string,
  input: {
    version: number;
    legalName?: string;
    displayName?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    slaHours?: number;
    status?: "ACTIVE" | "SUSPENDED";
  },
) {
  const contactPhone = toIndianMobileE164(input.contactPhone);
  return apiRequest<ClientOption>(`/clients/${clientId}`, {
    method: "PATCH",
    body: JSON.stringify({ ...input, contactPhone }),
  });
}

const checkMap: Record<CheckKey, string> = {
  identity: "IDENTITY",
  address: "ADDRESS",
  employment: "EMPLOYMENT",
  education: "EDUCATION",
  criminal: "CRIMINAL",
  reference: "REFERENCE",
};

const priorityMap = { Standard: "NORMAL", Priority: "HIGH", Critical: "URGENT" } as const;

export function createCase(draft: CaseDraft) {
  return apiRequest<{ id: string; caseNumber: string; status: string }>("/cases", {
    method: "POST",
    body: JSON.stringify({
      clientId: draft.clientId,
      fullName: draft.candidate,
      email: draft.email || undefined,
      phone: toIndianMobileE164(draft.phone),
      priority: priorityMap[draft.priority],
      checks: draft.checks.map((check) => checkMap[check]),
    }),
  });
}

export function transitionCase(
  caseId: string,
  input: { status: string; version: number; reason?: string },
) {
  return apiRequest<CaseDetail>(`/cases/${caseId}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

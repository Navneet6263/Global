import type { CaseDraft } from "@/features/cases/new-case/model";
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

export type CaseServicePackage = {
  id: string;
  code: string;
  name: string;
  checks: string[];
  price?: string | number | null;
  tatHours: number;
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
  servicePackage?: {
    publicId: string;
    code: string;
    name: string;
    tatHours: number;
  } | null;
  branch?: { publicId: string; name: string; city?: string | null } | null;
  assignedOpsUser?: { publicId: string; displayName: string } | null;
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
      blockerReason?: string | null;
      dueAt?: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
      version: number;
      assignee?: { publicId: string; displayName: string; email: string } | null;
    }>;
  }>;
  fieldVisits?: Array<{
    publicId: string;
    status: string;
    version: number;
    address: string;
    geofenceMeters: number;
    distanceMeters?: number | null;
    capturedAt?: string | null;
    checkedInAt?: string | null;
    completedAt?: string | null;
    createdAt: string;
    assignee?: { publicId: string; displayName: string; email: string } | null;
    _count?: { evidence: number };
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
    checkedInAt?: string | null;
    completedAt?: string | null;
    createdAt: string;
    assignee?: { publicId: string; displayName: string; email: string } | null;
    _count?: { evidence: number };
    evidence?: Array<{ publicId: string }>;
  }>;
}

export interface CaseListQueryInput {
  risk?: string;
  owner?: string;
  ownerId?: string;
  unassigned?: boolean;
  dueToday?: boolean;
  dueNext7Days?: boolean;
  view?: "all" | "operations";
  search?: string;
  status?: string;
  stage?: string;
  clientId?: string;
  priority?: string;
  sla?: string;
  from?: string;
  to?: string;
  sortBy?: "updatedAt" | "sla" | "candidateName" | "priority" | "progress";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  limit?: number;
  cursor?: string;
}

export interface CaseListResponse {
  items: CaseListItem[];
  nextCursor: string | null;
  total: number;
  page?: number;
  pageSize?: number;
}

export function listCases(input: CaseListQueryInput = {}, signal?: AbortSignal) {
  const query = new URLSearchParams();
  for (const key of [
    "risk",
    "owner",
    "ownerId",
    "unassigned",
    "dueToday",
    "dueNext7Days",
    "view",
  ] as const) {
    if (input[key] !== undefined) query.set(key, String(input[key]));
  }
  if (input.search) query.set("search", input.search);
  if (input.status) query.set("status", input.status);
  if (input.stage) query.set("stage", input.stage);
  if (input.clientId) query.set("clientId", input.clientId);
  if (input.priority) query.set("priority", input.priority);
  if (input.sla) query.set("sla", input.sla);
  if (input.from) query.set("from", input.from);
  if (input.to) query.set("to", input.to);
  if (input.sortBy) query.set("sortBy", input.sortBy);
  if (input.sortDir) query.set("sortDir", input.sortDir);
  if (input.page) query.set("page", String(input.page));
  if (input.pageSize) query.set("pageSize", String(input.pageSize));
  if (input.cursor) query.set("cursor", input.cursor);
  query.set("limit", String(input.limit ?? 20));
  return apiRequest<CaseListResponse>(`/cases?${query.toString()}`, { signal });
}

export function getCase(caseId: string) {
  return apiRequest<CaseDetail>(`/cases/${caseId}`);
}

export async function exportCases(input: Omit<CaseListQueryInput, "cursor" | "limit"> = {}) {
  const query = new URLSearchParams();
  for (const key of [
    "risk",
    "owner",
    "ownerId",
    "unassigned",
    "dueToday",
    "dueNext7Days",
    "view",
  ] as const) {
    if (input[key] !== undefined) query.set(key, String(input[key]));
  }
  if (input.search) query.set("search", input.search);
  if (input.status) query.set("status", input.status);
  if (input.stage) query.set("stage", input.stage);
  if (input.clientId) query.set("clientId", input.clientId);
  if (input.priority) query.set("priority", input.priority);
  if (input.sla) query.set("sla", input.sla);
  if (input.from) query.set("from", input.from);
  if (input.to) query.set("to", input.to);
  if (input.sortBy) query.set("sortBy", input.sortBy);
  if (input.sortDir) query.set("sortDir", input.sortDir);
  const blob = await apiDownload(`/cases/export?${query.toString()}`);
  saveBlob(blob, `sapling-global-cases-${new Date().toISOString().slice(0, 10)}.csv`);
}

export interface ClientListResponse {
  items: ClientOption[];
  nextCursor: string | null;
  total: number;
  page?: number;
  pageSize?: number;
}

export interface ClientListInput {
  search?: string;
  status?: string;
  cursor?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
}

export function listClients(): Promise<ClientListResponse>;
export function listClients(input: {
  search?: string;
  status?: string;
  cursor?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
}): Promise<ClientListResponse>;
export function listClients(input: ClientListInput = {}) {
  const query = new URLSearchParams({ limit: String(input.limit ?? 100) });
  if (input.search) query.set("search", input.search);
  if (input.status) query.set("status", input.status);
  if (input.cursor) query.set("cursor", input.cursor);
  if (input.page) query.set("page", String(input.page));
  if (input.pageSize) query.set("pageSize", String(input.pageSize));
  return apiRequest<ClientListResponse>(`/clients?${query.toString()}`);
}

export async function listAllClients(search?: string) {
  const items: ClientOption[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await listClients({ search, cursor, limit: 100 });
    items.push(...page.items);
    if (!page.nextCursor) break;
    if (seen.has(page.nextCursor)) throw new Error("Client pagination returned a repeated cursor");
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
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

const priorityMap = { Standard: "NORMAL", Priority: "HIGH", Critical: "URGENT" } as const;

export function listCaseServicePackages() {
  return apiRequest<{ items: CaseServicePackage[] }>("/cases/catalog");
}

export function createCase(draft: CaseDraft, idempotencyKey?: string) {
  return apiRequest<{
    id: string;
    caseNumber: string;
    status: string;
    consentDelivery: {
      consentId: string;
      expiresAt: string;
      developmentOtp?: string;
    };
  }>("/cases", {
    method: "POST",
    headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
    body: JSON.stringify({
      clientId: draft.clientId,
      servicePackageId: draft.servicePackageId,
      fullName: draft.candidate,
      email: draft.email || undefined,
      phone: toIndianMobileE164(draft.phone),
      priority: priorityMap[draft.priority],
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

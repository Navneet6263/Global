import type { CaseDraft } from "@/features/cases/new-case/model";
import type { CandidateAccessResult } from "./candidate-portal";
import { toIndianMobileE164 } from "@/lib/indian-mobile";
import { apiDownload, apiRequest, saveBlob } from "./client";
import type { CaseServiceScope } from "./case-services";

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
  serviceFamily?: string;
  requiredDocuments?: string[];
  price?: string | number | null;
  /** Each check on its own, after the agreed rate and discount (commercial viewers only). */
  checkPrices?: Record<string, number>;
  taxRate?: string | number | null;
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
  services?: CaseServiceScope[];
  servicePackage?: {
    publicId: string;
    code: string;
    name: string;
    tatHours: number;
  } | null;
  branch?: { publicId: string; name: string; city?: string | null } | null;
  assignedOpsUser?: { publicId: string; displayName: string } | null;
  /** The released report the viewer can download now (null until released). */
  report?: {
    id: string;
    version: number;
    releasedAt: string | null;
    downloadExpiresAt: string | null;
  } | null;
  /** Internal roles only: position in the RM -> Data Entry -> department flow. */
  workflow?: {
    version: number;
    intakeStage: "INTAKE" | "DATA_ENTRY" | "CORRECTION" | "READY" | "ROUTED" | null;
    dataEntryAssignedAt: string | null;
    dataEntryReadyAt: string | null;
    dataEntryUser: { publicId: string; displayName: string } | null;
    /** The client's company RM; new cases are assigned to this RM automatically. */
    companyRm?: { publicId: string; displayName: string } | null;
    stoppedFromStatus?: string | null;
    stoppedAt?: string | null;
    stopReason?: string | null;
    escalatedAt?: string | null;
    escalationNote?: string | null;
    escalatedBy?: { publicId: string; displayName: string } | null;
  };
  checks: Array<{
    publicId: string;
    type: string;
    status: string;
    routedAt?: string | null;
    department?: { publicId: string; name: string } | null;
    /** Internal only: Data Entry's check-wise initiation, JSON {"entries":[...]} */
    initiationJson?: string | null;
    initiatedAt?: string | null;
    /** Colour code: GREEN, RED, YELLOW, AMBER, BLUE or CLIENT_REVIEW. */
    disposition?: string | null;
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
      createdAt?: string;
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
  /** Company admin view only: its own escalation, never an internal one. */
  clientEscalation?: { at: string; reason: string } | null;
  qaReviewer?: { publicId: string; displayName: string; email: string } | null;
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
    version: number;
    reviewNote?: string | null;
    reviewedAt?: string | null;
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
    evidence?: Array<{
      publicId: string;
      type?: string;
      contentType?: string;
      capturedAt?: string;
      createdAt?: string;
    }>;
  }>;
}

export interface CaseListQueryInput {
  risk?: string;
  owner?: string;
  ownerId?: string;
  unassigned?: boolean;
  escalated?: boolean;
  dueToday?: boolean;
  dueNext7Days?: boolean;
  view?: "all" | "operations" | "active";
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
    "escalated",
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
    "escalated",
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

export function listCaseServicePackages(clientId?: string) {
  const query = clientId ? `?${new URLSearchParams({ clientId })}` : "";
  return apiRequest<{ items: CaseServicePackage[] }>(`/cases/catalog${query}`);
}

export function createCase(draft: CaseDraft, idempotencyKey?: string) {
  return apiRequest<{
    id: string;
    caseNumber: string;
    status: string;
    /** The single candidate link: consent (OTP) and uploads both happen inside it. */
    candidateAccess: CandidateAccessResult;
  }>("/cases", {
    method: "POST",
    headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
    body: JSON.stringify({
      clientId: draft.clientId,
      servicePackageId: draft.servicePackageId,
      services: draft.services?.length
        ? draft.services.map((service) => ({
            ...service,
            details: Object.fromEntries(
              Object.entries(service.details ?? {})
                .filter(([, value]) => value.trim())
                .map(([key, value]) => [
                  key,
                  key === "gstin" ? value.trim().toUpperCase() : value.trim(),
                ]),
            ),
          }))
        : undefined,
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

/** The company admin escalates its own case with a reason; it becomes high priority. */
export function escalateCaseAsClient(caseId: string, input: { version: number; reason: string }) {
  return apiRequest<{ id: string; escalated: true; escalatedAt: string; version: number }>(
    `/cases/${caseId}/client-escalation`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

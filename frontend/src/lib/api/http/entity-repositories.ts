import type { CaseRepository, ClientRepository, UserRepository } from "../repositories";
import type { CaseDetail, CaseListItem, ClientOption } from "@/lib/backend-api/cases";
import {
  createClient,
  getCase,
  listCases,
  listClients,
  updateClient,
} from "@/lib/backend-api/cases";
import {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
  type DirectoryUser,
} from "@/lib/backend-api/users";
import type {
  CasePriority,
  CaseStage,
  CheckStatus,
  CheckType,
  SlaState,
  VerificationCase,
} from "@/lib/contracts/case";
import type { ClientOrganisation, ClientStatus } from "@/lib/contracts/client";
import type { PlatformUser } from "@/lib/contracts/user";
import type { Role } from "@/config/roles";

const caseStatus: Record<string, CaseStage> = {
  DRAFT: "intake",
  CONSENT_PENDING: "consent",
  DOCUMENT_PENDING: "documents",
  IN_PROGRESS: "verification",
  CLARIFICATION_PENDING: "clarification",
  QA_REVIEW: "qa",
  COMPLETED: "completed",
  CLOSED: "completed",
  CANCELLED: "completed",
};

const stageProgress: Record<CaseStage, number> = {
  intake: 8,
  consent: 18,
  documents: 32,
  verification: 62,
  clarification: 68,
  qa: 88,
  completed: 100,
};

function checkType(value: string): CheckType {
  const normalized = value.toLowerCase();
  if (
    ["identity", "address", "employment", "education", "criminal", "reference"].includes(normalized)
  )
    return normalized as CheckType;
  return "identity";
}

function checkStatus(value: string): CheckStatus {
  const map: Record<string, CheckStatus> = {
    PENDING: "not_started",
    OPEN: "in_progress",
    UNASSIGNED: "not_started",
    IN_PROGRESS: "in_progress",
    BLOCKED: "awaiting_input",
    COMPLETED: "verified",
    DISCREPANCY: "discrepancy",
    UNABLE_TO_VERIFY: "unable_to_verify",
  };
  return map[value] ?? "not_started";
}

function priority(value: string): CasePriority {
  if (value === "URGENT") return "critical";
  if (value === "HIGH") return "high";
  return "standard";
}

function sla(dueAt?: string | null): { minutes: number; state: SlaState } {
  if (!dueAt) return { minutes: 0, state: "healthy" };
  const minutes = Math.round((Date.parse(dueAt) - Date.now()) / 60_000);
  return { minutes, state: minutes < 0 ? "overdue" : minutes <= 480 ? "approaching" : "healthy" };
}

function mapCase(row: CaseListItem | CaseDetail): VerificationCase {
  const stage = caseStatus[row.status] ?? "verification";
  const due = sla(row.dueAt);
  const firstTask = row.checks
    .flatMap((check) => check.tasks ?? [])
    .find((task) => task.assignee)?.assignee;
  const detail = row as CaseDetail;
  return {
    id: row.id,
    caseNumber: row.caseNumber,
    candidateName: row.subject.fullName,
    candidateEmail: row.subject.email ?? "",
    candidateMobile: row.subject.phone ?? "",
    clientId: row.client.publicId,
    clientName: row.client.displayName,
    packageName: `${row.checks.length} verification checks`,
    checkBundle: row.checks.map((check) => checkType(check.type)),
    stage,
    progress: stageProgress[stage],
    priority: priority(row.priority),
    slaMinutesRemaining: due.minutes,
    slaState: due.state,
    owner: firstTask?.displayName ?? "Unassigned",
    ownerRole: firstTask ? "Verifier" : "Operations",
    branch: "Unassigned",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    checks: row.checks.map((check) => ({
      id: check.publicId,
      type: checkType(check.type),
      label: check.type.replaceAll("_", " "),
      status: checkStatus(check.status),
      assignee: check.tasks?.find((task) => task.assignee)?.assignee?.displayName ?? "Unassigned",
      updatedAt: check.completedAt ?? row.updatedAt,
      note: check.sourceSummary ?? undefined,
    })),
    documents: (detail.documents ?? []).map((document) => ({
      id: document.publicId,
      label: document.type.replaceAll("_", " "),
      status:
        document.status === "VERIFIED"
          ? "verified"
          : document.status === "REJECTED"
            ? "rejected"
            : document.currentVersion > 0
              ? "received"
              : "pending",
      updatedAt: document.versions.at(-1)?.createdAt ?? row.updatedAt,
    })),
    clarifications: (detail.clarifications ?? []).map((item) => ({
      id: item.publicId,
      raisedBy: "Operations",
      audience: "client",
      question: item.subject,
      status:
        item.status === "RESOLVED" ? "closed" : item.status === "ANSWERED" ? "answered" : "open",
      raisedAt: item.createdAt,
      dueAt: item.dueAt ?? item.createdAt,
    })),
    timeline: (detail.statusHistory ?? []).map((event, index) => ({
      id: `${row.id}-${index}`,
      label: event.toStatus.replaceAll("_", " "),
      detail: event.reason ?? "Workflow status updated",
      at: event.createdAt,
      stage: caseStatus[event.toStatus] ?? "verification",
    })),
    assignments: [],
    reports: (detail.reports ?? []).map((report) => ({
      id: report.publicId,
      version: `v${report.currentVersion}`,
      publishedAt: report.publishedAt ?? report.createdAt,
      outcome: "clear",
      sizeKb: 0,
    })),
  };
}

export const caseRepository: CaseRepository = {
  async list(query) {
    const result = await listCases({
      search: query.search,
      status:
        query.stage && query.stage !== "all"
          ? Object.keys(caseStatus).find((key) => caseStatus[key] === query.stage)
          : undefined,
      clientId: query.clientId === "all" ? undefined : query.clientId,
      limit: 100,
    });
    let rows = result.items.map(mapCase);
    if (query.priority && query.priority !== "all")
      rows = rows.filter((row) => row.priority === query.priority);
    if (query.sla && query.sla !== "all") rows = rows.filter((row) => row.slaState === query.sla);
    const dir = query.sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (query.sortBy === "candidateName")
        return a.candidateName.localeCompare(b.candidateName) * dir;
      if (query.sortBy === "progress") return (a.progress - b.progress) * dir;
      if (query.sortBy === "sla") return (a.slaMinutesRemaining - b.slaMinutesRemaining) * dir;
      return (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)) * dir;
    });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    };
  },
  async getById(id) {
    try {
      return mapCase(await getCase(id));
    } catch {
      return null;
    }
  },
  async facets() {
    const result = await listClients();
    return {
      clients: result.items.map((client) => ({
        value: client.publicId,
        label: client.displayName,
      })),
    };
  },
};

function clientStatus(value: string): ClientStatus {
  if (value === "SUSPENDED") return "suspended";
  if (value === "ONBOARDING") return "onboarding";
  return "active";
}

function mapClient(row: ClientOption): ClientOrganisation & { version: number } {
  return {
    id: row.publicId,
    version: row.version,
    name: row.displayName,
    industry: "—",
    city: "—",
    status: clientStatus(row.status),
    slaCommitmentDays: Math.max(1, Math.round(row.slaHours / 24)),
    slaAttainment: 0,
    caseVolumeMtd: 0,
    caseVolumeTotal: 0,
    successRate: 0,
    outstandingActions: 0,
    primaryContact: row.contactName ?? "Not assigned",
    lastActivityAt: row.updatedAt,
    onboardedAt: row.createdAt,
    activeCases: 0,
    contacts: row.contactEmail
      ? [
          {
            id: `${row.publicId}-primary`,
            name: row.contactName ?? "Primary contact",
            designation: "Primary contact",
            email: row.contactEmail,
            mobile: row.contactPhone ?? "",
            isPrimary: true,
          },
        ]
      : [],
    billing: { invoicedThisQuarter: 0, outstanding: 0, paymentTermsDays: 30, lastPaymentAt: null },
    users: [],
    packages: [],
    audit: [],
  };
}

let knownClients: Array<ClientOrganisation & { version: number }> = [];

export const clientRepository: ClientRepository = {
  async list(query) {
    const response = await listClients();
    knownClients = response.items.map(mapClient);
    let rows = knownClients;
    if (query.search)
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(query.search!.toLowerCase()) ||
          row.primaryContact.toLowerCase().includes(query.search!.toLowerCase()),
      );
    if (query.status && query.status !== "all")
      rows = rows.filter((row) => row.status === query.status);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    };
  },
  async getById(id) {
    if (!knownClients.length) knownClients = (await listClients()).items.map(mapClient);
    return knownClients.find((row) => row.id === id) ?? null;
  },
  async create(draft) {
    const code = draft.name
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 12)
      .toUpperCase();
    return mapClient(
      await createClient({
        code,
        legalName: draft.name,
        displayName: draft.name,
        contactName: draft.primaryContactName,
        contactEmail: draft.primaryContactEmail,
        slaHours: draft.slaCommitmentDays * 24,
      }),
    );
  },
  async setStatus(id, status) {
    if (!knownClients.length) knownClients = (await listClients()).items.map(mapClient);
    const current = knownClients.find((row) => row.id === id);
    if (!current) throw new Error("Client not found");
    return mapClient(
      await updateClient(id, {
        version: current.version,
        status: status === "active" ? "ACTIVE" : "SUSPENDED",
      }),
    );
  },
};

function mapUser(row: DirectoryUser): PlatformUser & { version: number } {
  return {
    id: row.id,
    version: row.version,
    employeeId: row.id.slice(0, 8).toUpperCase(),
    fullName: row.displayName,
    email: row.email,
    mobile: row.phone ?? null,
    roles: row.roles.map((role) => role.code as Role),
    status:
      row.status === "SUSPENDED" ? "suspended" : row.mustChangePassword ? "invited" : "active",
    branchScope: row.branch ? [row.branch.name] : ["All branches"],
    clientWorkspaceScope: row.client ? [row.client.displayName] : [],
    lastLoginAt: row.lastLoginAt ?? null,
    createdAt: row.lastLoginAt ?? new Date(0).toISOString(),
    mfaEnabled: false,
  };
}

function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const body = Array.from(
    bytes,
    (value) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[value % 57],
  ).join("");
  return `${body}@7a`;
}

let knownUsers: Array<PlatformUser & { version: number }> = [];

export const userRepository: UserRepository = {
  async list(query) {
    knownUsers = (await listUsers(query.role === "all" ? undefined : query.role)).items.map(
      mapUser,
    );
    let rows = knownUsers;
    if (query.search)
      rows = rows.filter((row) =>
        [row.fullName, row.email, row.employeeId].some((value) =>
          value.toLowerCase().includes(query.search!.toLowerCase()),
        ),
      );
    if (query.status && query.status !== "all")
      rows = rows.filter((row) => row.status === query.status);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    };
  },
  async create(input) {
    const password = temporaryPassword();
    const result = await createUser({
      email: input.email,
      displayName: input.fullName,
      phone: input.mobile,
      branchId: input.branchScope[0] === "All branches" ? undefined : input.branchScope[0],
      clientId: input.clientWorkspaceScope[0],
      roleCodes: [...input.roles],
      temporaryPassword: password,
    });
    const user: PlatformUser = {
      id: result.id,
      employeeId: result.id.slice(0, 8).toUpperCase(),
      fullName: input.fullName,
      email: input.email,
      mobile: input.mobile ?? null,
      roles: input.roles,
      status: "invited",
      branchScope: input.branchScope,
      clientWorkspaceScope: input.clientWorkspaceScope,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      mfaEnabled: false,
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

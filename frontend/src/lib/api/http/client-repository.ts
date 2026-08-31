import type { ClientRepository } from "../repositories";
import type { ClientOption } from "@/lib/backend-api/cases";
import { createClient, listClients, updateClient } from "@/lib/backend-api/cases";
import { getExecutiveDashboard, type ExecutivePerformanceRow } from "@/lib/backend-api/dashboards";
import { listAllUsers, type DirectoryUser } from "@/lib/backend-api/users";
import type { ClientOrganisation, ClientStatus } from "@/lib/contracts/client";

function clientStatus(value: string): ClientStatus {
  if (value === "SUSPENDED") return "suspended";
  if (value === "ONBOARDING") return "onboarding";
  return "active";
}

function mapClient(
  row: ClientOption,
  performance?: ExecutivePerformanceRow,
  directory: DirectoryUser[] = [],
): ClientOrganisation & { version: number } {
  return {
    id: row.publicId,
    version: row.version,
    code: row.code,
    name: row.displayName,
    legalName: row.legalName,
    status: clientStatus(row.status),
    slaCommitmentDays: Math.max(1, Math.round(row.slaHours / 24)),
    slaAttainment: performance?.slaPercentage ?? null,
    caseVolumeTotal: performance?.total ?? 0,
    outstandingActions: performance?.overdue ?? 0,
    primaryContact: row.contactName ?? "Not assigned",
    lastActivityAt: row.updatedAt,
    onboardedAt: row.createdAt,
    activeCases: performance?.active ?? 0,
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
    users: directory
      .filter((user) => user.client?.publicId === row.publicId)
      .map((user) => ({
        id: user.id,
        name: user.displayName,
        email: user.email,
        role: user.roles.map((role) => role.name).join(", "),
        lastLoginAt: user.lastLoginAt ?? null,
      })),
  };
}

let knownClients: Array<ClientOrganisation & { version: number }> = [];

const statusQuery: Record<ClientStatus, string> = {
  active: "ACTIVE",
  onboarding: "ONBOARDING",
  suspended: "SUSPENDED",
};

async function loadClientPage(query: {
  search?: string;
  status?: ClientStatus | "all";
  page?: number;
  pageSize?: number;
}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const [clients, analytics, directory] = await Promise.all([
    listClients({
      search: query.search,
      status: query.status && query.status !== "all" ? statusQuery[query.status] : undefined,
      page,
      pageSize,
      limit: pageSize,
    }),
    getExecutiveDashboard({
      from: "2000-01-01T00:00:00.000Z",
      to: new Date().toISOString(),
      months: 3,
    }),
    listAllUsers(),
  ]);
  const performance = new Map(analytics.clientPerformance.map((row) => [row.id, row]));
  knownClients = clients.items.map((row) =>
    mapClient(row, performance.get(row.publicId), directory.items),
  );
  return {
    rows: knownClients,
    total: clients.total,
    page: clients.page ?? page,
    pageSize: clients.pageSize ?? pageSize,
  };
}

export const clientRepository: ClientRepository = {
  async list(query) {
    return loadClientPage(query);
  },
  async getById(id) {
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

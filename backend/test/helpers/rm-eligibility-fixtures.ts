import { createHash } from "node:crypto";
import type { PrismaService } from "../../src/database/prisma.service";
import { matchAccess, matchesWhere } from "./rm-eligibility-where-double";

export { matchesWhere };

export type ConsentRow = {
  id: bigint;
  publicId: string;
  caseId: bigint;
  status: string;
  otpHash: string | null;
  otpExpiresAt: Date | null;
  otpAttempts: number;
  noticeVersion: string;
  acceptedAt: Date | null;
};

export type PortalAccessRow = {
  id: bigint;
  publicId: string;
  tenantId: bigint;
  caseId: bigint;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  completedAt: Date | null;
  clarificationId?: bigint | null;
  clarification?: null;
};

export type DocRow = {
  id: bigint;
  type: string;
  status: string;
  currentVersion: number;
  reviewNote: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  versions: Array<{ version: number; malwareState: string; uploadedById: bigint | null }>;
};

export type AuditRow = {
  tenantId: bigint;
  action: string;
  resourceType: string;
  resourcePublicId: string;
};

export type CaseRow = {
  id: bigint;
  publicId: string;
  tenantId: bigint;
  branchId: bigint | null;
  clientId: bigint;
  caseNumber: string;
  status: string;
  stoppedFromStatus?: string | null;
  stoppedAt?: Date | null;
  priority: string;
  workflowVersion: number;
  intakeStage: string | null;
  assignedOpsUserId: bigint | null;
  dataEntryUserId: bigint | null;
  dataEntryAssignedAt: Date | null;
  dataEntryReadyAt: Date | null;
  escalatedAt: Date | null;
  escalationNote: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  version: number;
  subject: { fullName: string };
  client: {
    id: bigint;
    publicId: string;
    code: string;
    displayName: string;
    clientReviewFirst?: boolean;
    defaultDataEntryUser?: {
      id: bigint;
      publicId: string;
      displayName: string;
      status: string;
      userRoles: Array<{ role: { code: string; baseRoleCode: string | null } }>;
    } | null;
  };
  assignedOpsUser: { publicId: string; displayName: string } | null;
  dataEntryUser: { publicId: string; displayName: string } | null;
  services: Array<{ requiredDocumentsJson: string | null }>;
  checks: Array<{ type: string; status: string; department?: { name: string } | null; tasks: Array<{ status: string }> }>;
  documents: DocRow[];
  clarifications: Array<{ id?: bigint; level?: string; status?: string }>;
  fieldVisits: [];
  reports: [];
};

export interface StoreCtx {
  cases: CaseRow[];
  consents: ConsentRow[];
  accesses: PortalAccessRow[];
  audits: AuditRow[];
  notifications: Array<{ userId: bigint; type: string }>;
  users?: Array<{ id: bigint; publicId: string; displayName: string; status: string; roles: string[] }>;
}

export const testUuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const otpDigest = (cid: string, otp: string) => createHash("sha256").update(`${cid}:${otp}`).digest("hex");
export const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex");

function applyCaseUpdate(row: CaseRow, data: Record<string, unknown>) {
  if (typeof data.status === "string") row.status = data.status;
  if (typeof data.intakeStage === "string") row.intakeStage = data.intakeStage;
  if ("dataEntryUserId" in data) row.dataEntryUserId = data.dataEntryUserId as bigint | null;
  if ("dataEntryAssignedAt" in data) row.dataEntryAssignedAt = data.dataEntryAssignedAt as Date | null;
  if ("stoppedFromStatus" in data) row.stoppedFromStatus = data.stoppedFromStatus as string | null;
  if ("stoppedAt" in data) row.stoppedAt = data.stoppedAt as Date | null;
  row.version += 1;
}

export function createEligibilityStore(ctx: StoreCtx): PrismaService {
  const defaultDe = { id: 21n, publicId: testUuid(21), displayName: "Deepa DE", status: "ACTIVE", roles: ["DATA_ENTRY"] };
  const users = ctx.users ?? [defaultDe];
  const findDocs = (caseId: bigint) => ctx.cases.find((c) => c.id === caseId)?.documents ?? [];

  const prisma = {
    verificationCase: {
      findMany: ({ where = {}, take }: { where?: Record<string, unknown>; take?: number }) => {
        const hits = ctx.cases.filter((r) => matchesWhere(r, ctx, where)).map((r) => ({
          ...r,
          candidateAccess: ctx.accesses.filter((a) => a.caseId === r.id && a.completedAt === null && a.revokedAt === null),
        }));
        return Promise.resolve(take ? hits.slice(0, take) : hits);
      },
      findFirst: ({ where = {} }: { where?: Record<string, unknown> }) =>
        Promise.resolve(ctx.cases.find((r) => matchesWhere(r, ctx, where)) ?? null),
      findUnique: ({ where }: { where: { id: bigint } }) => {
        const row = ctx.cases.find((r) => r.id === where.id) ?? null;
        if (!row) return Promise.resolve(null);
        return Promise.resolve({
          ...row,
          consents: ctx.consents.filter((c) => c.caseId === row.id && ["REQUESTED", "WITHDRAWN"].includes(c.status)),
          clarifications: row.clarifications.filter((cl) => cl.level === "L2" && ["OPEN", "RESPONDED", "CANDIDATE_SUBMITTED", "DATA_ENTRY_PENDING"].includes(cl.status ?? "")),
        });
      },
      findUniqueOrThrow: ({ where }: { where: { id: bigint } }) => Promise.resolve(ctx.cases.find((r) => r.id === where.id)!),
      count: ({ where = {} }: { where?: Record<string, unknown> }) => Promise.resolve(ctx.cases.filter((r) => matchesWhere(r, ctx, where)).length),
      groupBy: ({ by, where = {} }: { by: string[]; where?: Record<string, unknown> }) => {
        if (by[0] !== "clientId") return Promise.resolve([]);
        const g = new Map<bigint, number>();
        for (const r of ctx.cases.filter((c) => matchesWhere(c, ctx, where))) g.set(r.clientId, (g.get(r.clientId) ?? 0) + 1);
        return Promise.resolve([...g.entries()].map(([clientId, n]) => ({ clientId, _count: { _all: n } })));
      },
      update: ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = ctx.cases.find((r) => r.id === where.id)!;
        applyCaseUpdate(row, data);
        return Promise.resolve(row);
      },
      updateMany: ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hits = ctx.cases.filter((row) => matchesWhere(row, ctx, where));
        hits.forEach((row) => applyCaseUpdate(row, data));
        return Promise.resolve({ count: hits.length });
      },
    },
    consent: {
      findUnique: ({ where }: { where: { publicId: string } }) => {
        const c = ctx.consents.find((item) => item.publicId === where.publicId);
        return Promise.resolve(c ? { ...c, case: ctx.cases.find((k) => k.id === c.caseId) } : null);
      },
      updateMany: ({ where, data }: { where: { id: bigint; status?: string; otpAttempts?: number; otpHash?: string; otpExpiresAt?: { gt: Date } }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const c of ctx.consents) {
          if (c.id !== where.id || (where.status && c.status !== where.status) || (where.otpHash && c.otpHash !== where.otpHash)) continue;
          if (where.otpExpiresAt?.gt && !(c.otpExpiresAt && c.otpExpiresAt > where.otpExpiresAt.gt)) continue;
          if (typeof data.status === "string") c.status = data.status;
          if (data.acceptedAt instanceof Date) c.acceptedAt = data.acceptedAt;
          count += 1;
        }
        return Promise.resolve({ count });
      },
    },
    candidatePortalAccess: {
      findUnique: ({ where }: { where: { publicId: string } }) => {
        const link = ctx.accesses.find((a) => a.publicId === where.publicId);
        if (!link) return Promise.resolve(null);
        const row = ctx.cases.find((k) => k.id === link.caseId)!;
        return Promise.resolve({
          ...link,
          tenant: { publicId: testUuid(7) },
          case: { ...row, consents: ctx.consents.filter((c) => c.caseId === row.id), clarifications: [] },
        });
      },
      findFirst: ({ where }: { where: { caseId: bigint; completedAt?: unknown; revokedAt?: unknown } }) =>
        Promise.resolve(ctx.accesses.find((a) => a.caseId === where.caseId && matchAccess(a, ctx, where)) ?? null),
      updateMany: ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hits = ctx.accesses.filter((a) => matchAccess(a, ctx, where));
        hits.forEach((a) => {
          if (data.completedAt instanceof Date) a.completedAt = data.completedAt;
          if (data.revokedAt instanceof Date) a.revokedAt = data.revokedAt;
        });
        return Promise.resolve({ count: hits.length });
      },
      deleteMany: ({ where }: { where: Record<string, unknown> }) => {
        const keep = ctx.accesses.filter((a) => !matchAccess(a, ctx, where));
        const count = ctx.accesses.length - keep.length;
        ctx.accesses.splice(0, ctx.accesses.length, ...keep);
        return Promise.resolve({ count });
      },
      create: ({ data }: { data: Partial<PortalAccessRow> & Omit<PortalAccessRow, "id" | "revokedAt" | "completedAt"> }) => {
        const row: PortalAccessRow = { id: BigInt(ctx.accesses.length + 500), revokedAt: null, completedAt: null, ...data };
        ctx.accesses.push(row);
        return Promise.resolve(row);
      },
    },
    caseService: { findMany: ({ where }: { where: { caseId: bigint } }) => Promise.resolve(ctx.cases.find((c) => c.id === where.caseId)?.services ?? []) },
    caseCheck: { findMany: ({ where }: { where: { caseId: bigint } }) => Promise.resolve(ctx.cases.find((c) => c.id === where.caseId)?.checks ?? []) },
    document: { findMany: ({ where }: { where: { caseId: bigint } }) => Promise.resolve(findDocs(where.caseId)), count: () => Promise.resolve(0) },
    client: {
      findMany: ({ where }: { where: { id: { in: bigint[] } } }) =>
        Promise.resolve([...new Map(ctx.cases.filter((c) => where.id.in.includes(c.clientId)).map((c) => [c.clientId, c.client])).values()]),
      count: () => Promise.resolve(0),
    },
    user: {
      findFirst: ({ where }: { where?: { publicId?: string; status?: string; OR?: Array<{ publicId?: string }> } }) => {
        const targetId = where?.publicId ?? where?.OR?.find((entry) => entry.publicId)?.publicId;
        const u = targetId
          ? users.find((x) => x.publicId === targetId && x.status === "ACTIVE" && x.roles.includes("DATA_ENTRY"))
          : users[0];
        return Promise.resolve(u ? { id: u.id, publicId: u.publicId, displayName: u.displayName } : null);
      },
      findMany: () => Promise.resolve([]),
    },
    auditEvent: {
      create: ({ data }: { data: AuditRow }) => { ctx.audits.push(data); return Promise.resolve(data); },
      findFirst: ({ where }: { where: { tenantId: bigint; resourceType: string; resourcePublicId: string; action: { in: string[] } } }) =>
        Promise.resolve(ctx.audits.find((a) => a.tenantId === where.tenantId && a.resourceType === where.resourceType && a.resourcePublicId === where.resourcePublicId && where.action.in.includes(a.action)) ?? null),
      findMany: ({ where }: { where: { tenantId: bigint; resourceType: string; resourcePublicId: { in: string[] }; action: { in: string[] } } }) =>
        Promise.resolve(ctx.audits.filter((a) => a.tenantId === where.tenantId && a.resourceType === where.resourceType && where.resourcePublicId.in.includes(a.resourcePublicId) && where.action.in.includes(a.action))),
    },
    notification: {
      create: ({ data }: { data: { userId: bigint; type: string } }) => { ctx.notifications.push(data); return Promise.resolve(data); },
      createMany: ({ data }: { data: Array<{ userId: bigint; type: string }> }) => { ctx.notifications.push(...data); return Promise.resolve({}); },
    },
    clarification: { count: () => Promise.resolve(0) },
    fieldVisit: { count: () => Promise.resolve(0) },
    consentEvent: { create: () => Promise.resolve({}) },
    outboxEvent: { create: () => Promise.resolve({}) },
    caseStatusHistory: { create: () => Promise.resolve({}) },
    $transaction: (fn: (client: unknown) => Promise<unknown>) => fn(prisma),
  };
  return prisma as unknown as PrismaService;
}

export function seedCaseRow(id: bigint, caseNumber: string, status: string, extra: Partial<CaseRow> = {}): CaseRow {
  const now = new Date();
  return {
    id, publicId: testUuid(Number(id)), tenantId: 7n, branchId: null, clientId: 40n, caseNumber, status,
    stoppedFromStatus: null, stoppedAt: null, priority: "NORMAL", workflowVersion: 2, intakeStage: "CANDIDATE_UPLOAD",
    assignedOpsUserId: 11n, dataEntryUserId: null, dataEntryAssignedAt: null, dataEntryReadyAt: null,
    escalatedAt: null, escalationNote: null, dueAt: new Date(now.getTime() + 86_400_000), completedAt: null,
    updatedAt: now, createdAt: now, version: 1, subject: { fullName: "Shalu Singh" },
    client: { id: 40n, publicId: testUuid(40), code: "SGA", displayName: "Sapling Global Assurance Private Limited" },
    assignedOpsUser: { publicId: testUuid(11), displayName: "Ashish" }, dataEntryUser: null,
    services: [{ requiredDocumentsJson: JSON.stringify(["AADHAAR"]) }], checks: [], documents: [], clarifications: [],
    fieldVisits: [], reports: [], ...extra,
  };
}

export const seedConsentRow = (id: bigint, caseId: bigint, status: string, otp?: string): ConsentRow => ({
  id, publicId: testUuid(Number(id)), caseId, status,
  otpHash: otp ? otpDigest(testUuid(Number(id)), otp) : null,
  otpExpiresAt: otp ? new Date(Date.now() + 60_000) : null,
  otpAttempts: 0, noticeVersion: "2026-01", acceptedAt: status === "ACCEPTED" ? new Date() : null,
});

export const seedAccessRow = (id: bigint, caseId: bigint, completedAt: Date | null = null, token = "portal-secret-token"): PortalAccessRow => ({
  id, publicId: testUuid(Number(id)), tenantId: 7n, caseId, tokenHash: tokenDigest(token),
  expiresAt: new Date(Date.now() + 86_400_000), revokedAt: completedAt, completedAt,
});

export const cleanDoc = (id: bigint, type = "AADHAAR", uploadedById: bigint | null = null): DocRow => ({
  id, type, status: "AVAILABLE", currentVersion: 1, reviewNote: null, expiresAt: null, createdAt: new Date(),
  versions: [{ version: 1, malwareState: "CLEAN", uploadedById }],
});

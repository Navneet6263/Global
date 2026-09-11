import type { Actor } from "../../src/common/auth/actor";
import { PrismaService } from "../../src/database/prisma.service";
import { DispatchCommitService } from "../../src/cases/dispatch/dispatch-commit.service";
import type { DispatchCommitDto } from "../../src/cases/dispatch/dispatch.dto";
import type { DispatchCase } from "../../src/cases/dispatch/dispatch.policy";

export const uuid = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
export const dispatchActor: Actor = {
  userId: 1n,
  userPublicId: uuid(1),
  tenantId: 2n,
  tenantPublicId: uuid(2),
  tenantName: "Test",
  displayName: "Operator",
  email: "ops@example.invalid",
  mustChangePassword: false,
  roles: ["OPS_MANAGER"],
  permissions: ["case:read", "case:transition", "task:write"],
  branchId: 3n,
};
export function dispatchRecord(): DispatchCase {
  return {
    id: 10n,
    publicId: uuid(10),
    caseNumber: "SG-TEST-10",
    status: "DOCUMENT_PENDING",
    version: 2,
    branchId: 3n,
    clientId: 4n,
    dueAt: new Date("2026-09-30"),
    subject: { fullName: "Test Candidate" },
    branch: { publicId: uuid(3), name: "Test Branch" },
    client: { publicId: uuid(4), displayName: "Test Client" },
    consents: [{ id: 5n }],
    services: [{ requiredDocumentsJson: '["PAN"]' }],
    documents: [
      {
        type: "PAN",
        status: "VERIFIED",
        currentVersion: 1,
        expiresAt: null,
        createdAt: new Date("2026-09-09"),
      },
    ],
    checks: [20, 21].map((id) => ({
      id: BigInt(id),
      publicId: uuid(id),
      type: "IDENTITY",
      status: "PENDING",
      version: 1,
      tasks: [],
    })),
  };
}
export function dispatchInput(): DispatchCommitDto {
  return {
    operationId: uuid(99),
    version: 2,
    allocations: [20, 21].map((id) => ({
      checkId: uuid(id),
      checkVersion: 1,
      assigneeId: uuid(6),
    })),
    instructions: "Check original source",
  };
}

export function dispatchHarness(
  record: DispatchCase | null = dispatchRecord(),
) {
  const state = {
    record: structuredClone(record),
    writes: [] as { kind: string; data: unknown }[],
    receipt: null as string | null,
  };
  const controls = {
    failNotification: false,
    lockCount: 1,
    verifierBranch: 3n as bigint | null,
    verifierClient: null as bigint | null,
    activeVerifier: true,
  };
  let isolation: unknown;
  let lookup: unknown;
  const save = (kind: string, data: unknown) => {
    state.writes.push({ kind, data });
    return Promise.resolve(data);
  };
  const tx = {
    verificationCase: {
      findFirst: (query: unknown) => {
        lookup = query;
        return Promise.resolve(structuredClone(state.record));
      },
      updateMany: (query: { data: { status: string } }) => {
        state.writes.push({ kind: "case", data: query });
        if (state.record && controls.lockCount) {
          state.record.status = query.data.status;
          state.record.version += 1;
        }
        return Promise.resolve({ count: controls.lockCount });
      },
    },
    user: {
      findMany: () =>
        Promise.resolve(
          controls.activeVerifier
            ? [
                {
                  id: 6n,
                  publicId: uuid(6),
                  displayName: "Verifier",
                  branchId: controls.verifierBranch,
                  clientId: controls.verifierClient,
                },
              ]
            : [],
        ),
    },
    checkTask: {
      createMany: (query: { data: unknown[] }) => {
        for (const item of query.data)
          state.writes.push({ kind: "task", data: item });
        return Promise.resolve({ count: query.data.length });
      },
      updateMany: (query: unknown) => {
        state.writes.push({ kind: "existing-task", data: query });
        return Promise.resolve({ count: 1 });
      },
    },
    caseCheck: {
      updateMany: (query: { where: { OR: unknown[] } }) => {
        state.writes.push({ kind: "check", data: query });
        return Promise.resolve({ count: query.where.OR.length });
      },
    },
    notification: {
      createMany: (query: { data: unknown[] }) => {
        if (controls.failNotification)
          throw new Error("Simulated notification persistence failure");
        for (const item of query.data)
          state.writes.push({ kind: "notification", data: item });
        return Promise.resolve({ count: query.data.length });
      },
    },
    caseStatusHistory: { create: (query: unknown) => save("history", query) },
    outboxEvent: { create: (query: unknown) => save("outbox", query) },
    auditEvent: {
      createMany: (query: { data: unknown[] }) => {
        for (const item of query.data)
          state.writes.push({ kind: "audit", data: item });
        return Promise.resolve({ count: query.data.length });
      },
      findFirst: () =>
        Promise.resolve(state.receipt ? { afterJson: state.receipt } : null),
      create: (query: { data: { action: string; afterJson: string } }) => {
        if (query.data.action === "case.dispatch.committed")
          state.receipt = query.data.afterJson;
        return save("audit", query);
      },
    },
  };
  const prisma = {
    $transaction: async (
      work: (client: typeof tx) => Promise<unknown>,
      options: unknown,
    ) => {
      isolation = options;
      const before = structuredClone(state);
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    },
  };
  return {
    service: new DispatchCommitService(prisma as unknown as PrismaService),
    state,
    controls,
    isolation: () => isolation,
    lookup: () => lookup,
  };
}

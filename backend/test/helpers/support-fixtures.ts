import type { PrismaService } from "../../src/database/prisma.service";
import { CreateSupportRequestService } from "../../src/support/services/create-support-request.service";
import { RequesterSupportRequestsService } from "../../src/support/services/requester-support-requests.service";
import { SupportInboxService } from "../../src/support/services/support-inbox.service";
import { UpdateSupportRequestService } from "../../src/support/services/update-support-request.service";
import { SupportRepository } from "../../src/support/support.repository";
import { testActor } from "./test-actor";

export type Args = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: Record<string, unknown>;
};

export const agent = testActor(
  ["SUPPORT_AGENT"],
  ["support:read", "support:handle", "notification:read"],
  { displayName: "Sia Support" },
);
export const clientAdmin = testActor(["CLIENT_ADMIN"], ["support:request"], {
  userId: 41n,
  clientId: 21n,
});

/** Support services over one fake Prisma; every call is recorded by name. */
export function storedRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 5n,
    publicId: "req-1",
    requestNumber: "SR-20260929-ABC123",
    requesterType: "CLIENT_ADMIN",
    requesterUserId: 41n,
    subject: "Report status",
    message: "When will the report be ready?",
    status: "OPEN",
    resolutionNote: null,
    resolvedAt: null,
    version: 1,
    assignedToId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    requester: { displayName: "Cara Client" },
    assignedTo: null,
    client: { publicId: "client-a", displayName: "Client A" },
    case: {
      publicId: "case-1",
      caseNumber: "SG-1",
      status: "IN_PROGRESS",
      subject: { fullName: "Vivo" },
    },
    ...overrides,
  };
}

export function supportHarness(
  options: {
    open?: number;
    current?: unknown;
    updated?: number;
    linkedCase?: unknown;
  } = {},
) {
  const calls: Record<string, Args[]> = {};
  const record =
    (key: string, result: unknown) =>
    (value: Args): Promise<unknown> => {
      (calls[key] ??= []).push(value);
      return Promise.resolve(result);
    };
  const tx = {
    supportRequest: {
      count: record("open", options.open ?? 0),
      create: (value: Args) => {
        (calls.create ??= []).push(value);
        return Promise.resolve({
          ...storedRequest(),
          requesterType: value.data!.requesterType,
          case: value.data!.caseId ? { caseNumber: "SG-1" } : null,
        });
      },
      findFirst: record(
        "current",
        "current" in options ? options.current : storedRequest(),
      ),
      updateMany: record("update", { count: options.updated ?? 1 }),
    },
    auditEvent: { create: record("audit", {}) },
    user: { findMany: record("agents", [{ id: 71n }, { id: 72n }]) },
    notification: {
      createMany: record("notifyAgents", { count: 2 }),
      create: record("notifyRequester", {}),
    },
  };
  const prisma = {
    $transaction: (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
    client: {
      findFirst: record("client", { id: 21n, displayName: "Client A" }),
    },
    verificationCase: {
      findFirst: record("case", options.linkedCase ?? null),
    },
    user: { findFirst: () => Promise.resolve({ displayName: "Cara Client" }) },
    supportRequest: {
      findFirst: record("detail", storedRequest({ status: "IN_PROGRESS" })),
      findMany: record("list", []),
      count: () => Promise.resolve(0),
    },
  } as unknown as PrismaService;
  const repository = new SupportRepository(prisma);
  const inbox = new SupportInboxService(repository);
  return {
    create: new CreateSupportRequestService(repository),
    requester: new RequesterSupportRequestsService(repository),
    inbox,
    updater: new UpdateSupportRequestService(repository, inbox),
    calls,
  };
}

export const request = {
  subject: "Upload is failing",
  message: "My certificate upload keeps failing.",
};

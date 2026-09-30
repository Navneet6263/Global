import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../src/database/prisma.service";
import type { DocumentsService } from "../src/documents/documents.service";
import { DelegateVendorRequestService } from "../src/vendor-requests/services/delegate-vendor-request.service";
import { VendorRequestsRepository } from "../src/vendor-requests/vendor-requests.repository";
import { VendorTeamRepository } from "../src/vendor-requests/vendor-team.repository";
import { REQ, vendorWorkspace } from "./helpers/vendor-fixtures";
import { MEMBER, mainVendor, teamUser } from "./helpers/vendor-team-fixtures";

type Call = { name: string; args: Record<string, unknown> };

const pending = (extra: Record<string, unknown> = {}) => ({
  id: 61n,
  publicId: REQ,
  status: "PENDING",
  version: 2,
  handlerUserId: null,
  lastRemindedAt: null,
  document: { type: "EDUCATION_CERTIFICATE" },
  case: { caseNumber: "SG-1" },
  client: { displayName: "Client A" },
  handler: null,
  ...extra,
});

function delegation(
  row: unknown,
  member: unknown = {
    id: 42n,
    publicId: MEMBER,
    displayName: "Asha",
    status: "ACTIVE",
    version: 1,
  },
) {
  const calls: Call[] = [];
  const record =
    (name: string, result: unknown) => (args: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve(result);
    };
  const tx = {
    vendorAssignment: {
      findFirst: record("request", row),
      updateMany: record("handler", { count: 1 }),
      update: record("reminded", {}),
    },
    user: { findFirst: record("member", member) },
    notification: { create: record("notify", {}) },
    auditEvent: { create: record("audit", {}) },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const service = new DelegateVendorRequestService(
    new VendorRequestsRepository(prisma),
    new VendorTeamRepository(prisma),
  );
  return { service, calls, names: () => calls.map((call) => call.name) };
}

void test("the Main Vendor delegates a pending request to its own active team user", async () => {
  const { service, calls, names } = delegation(pending());
  const result = await service.delegate(mainVendor, REQ, {
    handlerId: MEMBER,
    version: 2,
  });
  assert.equal(result.handler?.name, "Asha");
  assert.deepEqual(names(), [
    "request",
    "member",
    "handler",
    "audit",
    "notify",
  ]);
  assert.deepEqual(calls[0]!.args.where, {
    tenantId: 7n,
    vendorUserId: 31n,
    publicId: REQ,
  });
  const memberWhere = calls[1]!.args.where as Record<string, unknown>;
  assert.equal(memberWhere.vendorOwnerId, 31n);
  assert.equal(memberWhere.status, "ACTIVE");
  assert.deepEqual(calls[2]!.args.where, {
    id: 61n,
    version: 2,
    status: "PENDING",
  });
  assert.equal(
    (calls[2]!.args.data as Record<string, unknown>).handlerUserId,
    42n,
  );
  const notice = calls[4]!.args.data as Record<string, unknown>;
  assert.equal(notice.userId, 42n);
  assert.equal(notice.type, "VENDOR_REQUEST_DELEGATED");

  const back = delegation(
    pending({
      handlerUserId: 42n,
      handler: { publicId: MEMBER, displayName: "Asha" },
    }),
  );
  const taken = await back.service.delegate(mainVendor, REQ, {
    handlerId: null,
    version: 2,
  });
  assert.equal(taken.handler, null);
  assert.ok(!back.names().includes("notify"));
});

void test("delegation is refused for team users, strangers, decided, stale and unchanged requests", async () => {
  await assert.rejects(
    delegation(pending()).service.delegate(teamUser, REQ, {
      handlerId: MEMBER,
      version: 2,
    }),
    ForbiddenException,
  );
  await assert.rejects(
    delegation(pending(), null).service.delegate(mainVendor, REQ, {
      handlerId: MEMBER,
      version: 2,
    }),
    NotFoundException,
  );
  await assert.rejects(
    delegation(null).service.delegate(mainVendor, REQ, {
      handlerId: MEMBER,
      version: 2,
    }),
    NotFoundException,
  );
  await assert.rejects(
    delegation(pending({ status: "APPROVED" })).service.delegate(
      mainVendor,
      REQ,
      {
        handlerId: MEMBER,
        version: 2,
      },
    ),
    ConflictException,
  );
  await assert.rejects(
    delegation(pending()).service.delegate(mainVendor, REQ, {
      handlerId: MEMBER,
      version: 1,
    }),
    /refresh/,
  );
  await assert.rejects(
    delegation(pending({ handlerUserId: 42n })).service.delegate(
      mainVendor,
      REQ,
      {
        handlerId: MEMBER,
        version: 2,
      },
    ),
    /already with this person/,
  );
});

void test("reminders go only to the holder of a delegated request, at most once an hour", async () => {
  const held = {
    handlerUserId: 42n,
    handler: { publicId: MEMBER, displayName: "Asha" },
  };
  await assert.rejects(
    delegation(pending()).service.remind(mainVendor, REQ),
    /delegated to a team user/,
  );
  await assert.rejects(
    delegation(
      pending({ ...held, lastRemindedAt: new Date(Date.now() - 10 * 60_000) }),
    ).service.remind(mainVendor, REQ),
    /last hour/,
  );
  const ok = delegation(
    pending({ ...held, lastRemindedAt: new Date(Date.now() - 2 * 3_600_000) }),
  );
  await ok.service.remind(mainVendor, REQ);
  assert.deepEqual(ok.names(), ["request", "reminded", "notify", "audit"]);
  const notice = ok.calls[2]!.args.data as Record<string, unknown>;
  assert.equal(notice.userId, 42n);
  assert.equal(notice.type, "VENDOR_REQUEST_REMINDER");
  await assert.rejects(
    delegation(pending(held)).service.remind(teamUser, REQ),
    ForbiddenException,
  );
});

void test("a team user decides only its delegated request, and SPOC-RM sees who decided", async () => {
  const calls: Call[] = [];
  const record =
    (name: string, result: unknown) => (args: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve(result);
    };
  const row = {
    id: 61n,
    publicId: REQ,
    attempt: 1,
    status: "PENDING",
    version: 1,
    clientId: 21n,
    assignedById: 11n,
    documentVersion: 2,
    document: { publicId: "doc", type: "EDUCATION_CERTIFICATE" },
    case: { publicId: "case-1", caseNumber: "SG-1" },
    client: { displayName: "Client A" },
    vendor: { displayName: "XYZ Vendors" },
  };
  const tx = {
    vendorAssignment: {
      findFirst: record("row", row),
      updateMany: record("update", { count: 1 }),
    },
    auditEvent: { create: record("audit", {}) },
    user: { findMany: record("recipients", [{ id: 11n }]) },
    notification: { createMany: record("notices", {}) },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  await vendorWorkspace(prisma, {} as DocumentsService).decide(teamUser, REQ, {
    decision: "REJECTED",
    reason: "Seal is unreadable",
    version: 1,
  });
  const find = calls.find((call) => call.name === "row")!.args.where as Record<
    string,
    unknown
  >;
  assert.equal(find.handlerUserId, 41n);
  assert.equal(find.vendorUserId, 31n);
  const update = calls.find((call) => call.name === "update")!;
  assert.equal(
    (update.args.where as Record<string, unknown>).handlerUserId,
    41n,
  );
  assert.equal((update.args.data as Record<string, unknown>).decidedById, 41n);
  const notices = calls.find((call) => call.name === "notices")!.args
    .data as Array<Record<string, unknown>>;
  assert.match(String(notices[0]!.body), /Ravi \(XYZ Vendors\) rejected/);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../src/database/prisma.service";
import {
  DOC,
  REQ,
  VENDOR_1,
  VENDOR_2,
  args,
  spocA,
  vendorWriters,
  type Args,
  type Seen,
} from "./helpers/vendor-fixtures";

const openCase = {
  id: 81n,
  publicId: "case-1",
  caseNumber: "SG-1001",
  status: "IN_PROGRESS",
  clientId: 21n,
  client: { displayName: "Client A" },
};
const activeVendor = {
  id: 32n,
  publicId: VENDOR_2,
  displayName: "Beta Checks",
};

function writePrisma(found: unknown, vendor: unknown = activeVendor) {
  const seen: Seen = {};
  const record = (key: string, result: unknown) => (value: Args) => {
    seen[key] = value;
    return Promise.resolve(result);
  };
  const tx = {
    document: { findFirst: record("document", found) },
    user: { findFirst: record("vendor", vendor) },
    vendorAssignment: {
      findFirst: record("previous", found),
      create: (value: {
        data: { attempt: number; documentVersion: number };
      }) => {
        seen.created = value;
        return Promise.resolve({
          publicId: "new-1",
          attempt: value.data.attempt,
          status: "PENDING",
          version: 1,
          documentVersion: value.data.documentVersion,
          createdAt: new Date(0),
        });
      },
    },
    auditEvent: { create: record("audit", {}) },
    notification: { create: record("notification", {}) },
  };
  const prisma = {
    $transaction: (
      work: (client: unknown) => Promise<unknown>,
      options: unknown,
    ) => {
      seen.options = options;
      return work(tx);
    },
  } as unknown as PrismaService;
  return { service: vendorWriters(prisma), seen };
}

const uploaded = (extra: Record<string, unknown> = {}) => ({
  id: 91n,
  publicId: DOC,
  type: "DEGREE_CERTIFICATE",
  case: openCase,
  versions: [{ version: 2 }],
  vendorAssignments: [],
  ...extra,
});

void test("assign pins the current clean version, notifies the vendor and audits, inside a serializable write", async () => {
  const { service, seen } = writePrisma(uploaded());
  const result = await service.assign(spocA, DOC, {
    vendorId: VENDOR_2,
    note: "  Check the university seal  ",
  });
  assert.deepEqual(args(seen, "document").where, {
    tenantId: 7n,
    publicId: DOC,
    case: { tenantId: 7n, clientId: { in: [21n] } },
  });
  assert.deepEqual(args(seen, "created").data, {
    tenantId: 7n,
    clientId: 21n,
    caseId: 81n,
    documentId: 91n,
    documentVersion: 2,
    attempt: 1,
    vendorUserId: 32n,
    assignedById: 11n,
    assignmentNote: "Check the university seal",
  });
  assert.deepEqual(seen.options, { isolationLevel: "Serializable" });
  assert.equal(args(seen, "audit").data?.action, "vendor_assignment.assigned");
  assert.equal(args(seen, "audit").data?.resourceType, "vendor_assignment");
  const notice = args(seen, "notification").data;
  assert.equal(notice?.userId, 32n);
  assert.equal(notice?.type, "VENDOR_REQUEST_ASSIGNED");
  assert.equal(notice?.href, "/vendor");
  const vendorWhere = args(seen, "vendor").where;
  assert.equal(vendorWhere?.status, "ACTIVE");
  assert.deepEqual(vendorWhere?.userRoles, {
    some: { role: { code: "VENDOR" } },
  });
  assert.equal(result.attempt, 1);
});

void test("assign refuses assigned, closed, unsafe, foreign and non-vendor cases without writing", async () => {
  const cases: Array<[unknown, unknown, new (...a: never[]) => Error]> = [
    [
      uploaded({ vendorAssignments: [{ attempt: 1, status: "REJECTED" }] }),
      activeVendor,
      ConflictException,
    ],
    [
      uploaded({ case: { ...openCase, status: "CANCELLED" } }),
      activeVendor,
      ConflictException,
    ],
    [uploaded({ versions: [] }), activeVendor, ConflictException],
    [null, activeVendor, NotFoundException],
    [uploaded(), null, NotFoundException],
  ];
  for (const [found, vendor, error] of cases) {
    const { service, seen } = writePrisma(found, vendor);
    await assert.rejects(
      service.assign(spocA, DOC, { vendorId: VENDOR_2 }),
      error,
    );
    assert.equal(seen.created, undefined);
  }
});

void test("a racing second assignment of the same attempt becomes a 409", async () => {
  const racing = vendorWriters({
    $transaction: () =>
      Promise.reject(Object.assign(new Error("dup"), { code: "P2002" })),
  } as unknown as PrismaService);
  await assert.rejects(
    racing.assign(spocA, DOC, { vendorId: VENDOR_2 }),
    ConflictException,
  );
});

const rejected = (extra: Record<string, unknown> = {}) => ({
  publicId: REQ,
  attempt: 1,
  status: "REJECTED",
  version: 2,
  decisionReason: "Seal is unreadable",
  vendor: { publicId: VENDOR_1, displayName: "Acme Vendors" },
  case: openCase,
  document: {
    id: 91n,
    publicId: DOC,
    type: "DEGREE_CERTIFICATE",
    versions: [{ version: 3 }],
    vendorAssignments: [{ attempt: 1, status: "REJECTED" }],
  },
  ...extra,
});

void test("re-assign adds attempt n+1 on the current version and never edits the rejected row", async () => {
  const { service, seen } = writePrisma(rejected());
  const result = await service.reassign(spocA, REQ, {
    vendorId: VENDOR_2,
    resolutionNote: "  Client uploaded a clear scan  ",
    version: 2,
  });
  assert.deepEqual(args(seen, "previous").where, {
    tenantId: 7n,
    publicId: REQ,
    case: { tenantId: 7n, clientId: { in: [21n] } },
  });
  const data = args(seen, "created").data;
  assert.equal(data?.attempt, 2);
  assert.equal(data?.documentVersion, 3);
  assert.equal(data?.vendorUserId, 32n);
  assert.equal(data?.resolutionNote, "Client uploaded a clear scan");
  const audit = args(seen, "audit").data;
  assert.equal(audit?.action, "vendor_assignment.reassigned");
  assert.equal(
    (JSON.parse(String(audit?.beforeJson)) as { rejectionReason: string })
      .rejectionReason,
    "Seal is unreadable",
  );
  assert.match(String(args(seen, "notification").data?.title), /re-assigned/);
  assert.equal(result.attempt, 2);
});

void test("re-assign is refused unless the latest attempt is rejected, current and resolved", async () => {
  const refusals: Array<
    [Record<string, unknown>, number, string, new (...a: never[]) => Error]
  > = [
    [
      {
        status: "PENDING",
        document: {
          ...rejected().document,
          vendorAssignments: [{ attempt: 1, status: "PENDING" }],
        },
      },
      2,
      "Clear scan uploaded",
      ConflictException,
    ],
    [
      {
        status: "APPROVED",
        document: {
          ...rejected().document,
          vendorAssignments: [{ attempt: 1, status: "APPROVED" }],
        },
      },
      2,
      "Clear scan uploaded",
      ConflictException,
    ],
    [
      {
        document: {
          ...rejected().document,
          vendorAssignments: [
            { attempt: 1, status: "REJECTED" },
            { attempt: 2, status: "REJECTED" },
          ],
        },
      },
      2,
      "Clear scan uploaded",
      ConflictException,
    ],
    [{}, 1, "Clear scan uploaded", ConflictException],
    [{}, 2, "  ok  ", BadRequestException],
  ];
  for (const [extra, version, resolutionNote, error] of refusals) {
    const { service, seen } = writePrisma(rejected(extra));
    await assert.rejects(
      service.reassign(spocA, REQ, {
        vendorId: VENDOR_2,
        resolutionNote,
        version,
      }),
      error,
    );
    assert.equal(seen.created, undefined);
  }
});

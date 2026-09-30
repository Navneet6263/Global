import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../src/database/prisma.service";
import type { DocumentsService } from "../src/documents/documents.service";
import {
  DOC,
  REQ,
  args,
  vendorOne,
  vendorWorkspace,
  type Args,
  type Seen,
} from "./helpers/vendor-fixtures";

const pending = {
  id: 61n,
  publicId: REQ,
  attempt: 1,
  status: "PENDING",
  version: 1,
  clientId: 21n,
  assignedById: 11n,
  documentVersion: 2,
  document: { publicId: DOC, type: "DEGREE_CERTIFICATE" },
  case: { publicId: "case-1", caseNumber: "SG-1001" },
  client: { displayName: "Client A" },
};

function decidePrisma(row: unknown, updated = 1) {
  const seen: Seen = {};
  const record = (key: string, result: unknown) => (value: Args) => {
    seen[key] = value;
    return Promise.resolve(result);
  };
  const tx = {
    vendorAssignment: {
      findFirst: record("row", row),
      updateMany: record("update", { count: updated }),
    },
    auditEvent: { create: record("audit", {}) },
    user: { findMany: record("recipients", [{ id: 11n }, { id: 12n }]) },
    notification: { createMany: record("notices", {}) },
  };
  const prisma = {
    $transaction: (work: (client: unknown) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const service = vendorWorkspace(prisma, {} as DocumentsService);
  return { service, seen };
}

void test("approve records the vendor, time and decision and notifies the SPOC side", async () => {
  const { service, seen } = decidePrisma(pending);
  const result = await service.decide(vendorOne, REQ, {
    decision: "APPROVED",
    version: 1,
  });
  assert.deepEqual(args(seen, "row").where, {
    tenantId: 7n,
    vendorUserId: 31n,
    publicId: REQ,
  });
  const update = args(seen, "update");
  assert.deepEqual(update.where, {
    id: 61n,
    tenantId: 7n,
    vendorUserId: 31n,
    status: "PENDING",
    version: 1,
  });
  assert.equal(update.data?.status, "APPROVED");
  assert.equal(update.data?.decisionReason, null);
  assert.equal(update.data?.decidedById, 31n);
  assert.ok(update.data?.decidedAt instanceof Date);
  assert.equal(args(seen, "audit").data?.action, "vendor_assignment.approved");
  assert.deepEqual(args(seen, "recipients").where, {
    tenantId: 7n,
    status: "ACTIVE",
    OR: [
      { id: 11n, userRoles: { some: { role: { code: "PLATFORM_ADMIN" } } } },
      {
        spocClientScopes: { some: { clientId: 21n } },
        userRoles: { some: { role: { code: "SPOC_RM" } } },
      },
    ],
  });
  const notices = (seen.notices as { data: Array<Record<string, unknown>> })
    .data;
  assert.equal(notices.length, 2);
  assert.equal(notices[0]?.type, "VENDOR_REQUEST_APPROVED");
  assert.equal(notices[0]?.href, "/spoc-rm/vendors");
  assert.equal(result.status, "APPROVED");
  assert.equal(result.version, 2);
});

void test("reject needs a reason, saves it and puts it in the SPOC notification", async () => {
  for (const reason of [undefined, "   ", "abc"]) {
    const { service, seen } = decidePrisma(pending);
    await assert.rejects(
      service.decide(vendorOne, REQ, {
        decision: "REJECTED",
        reason,
        version: 1,
      }),
      BadRequestException,
    );
    assert.equal(seen.row, undefined);
  }
  const { service, seen } = decidePrisma(pending);
  await service.decide(vendorOne, REQ, {
    decision: "REJECTED",
    reason: "  Seal is unreadable  ",
    version: 1,
  });
  assert.equal(args(seen, "update").data?.status, "REJECTED");
  assert.equal(args(seen, "update").data?.decisionReason, "Seal is unreadable");
  const notice = (seen.notices as { data: Array<Record<string, unknown>> })
    .data[0];
  assert.equal(notice?.type, "VENDOR_REQUEST_REJECTED");
  assert.match(
    String(notice?.body),
    /Acme Vendors rejected .*Seal is unreadable/,
  );
});

void test("a decision is refused for another vendor's, decided, stale or raced requests", async () => {
  const refusals: Array<
    [unknown, number, number, new (...a: never[]) => Error]
  > = [
    [null, 1, 1, NotFoundException],
    [{ ...pending, status: "APPROVED" }, 1, 1, ConflictException],
    [pending, 2, 1, ConflictException],
    [pending, 1, 0, ConflictException],
  ];
  for (const [row, version, updated, error] of refusals) {
    const { service, seen } = decidePrisma(row, updated);
    await assert.rejects(
      service.decide(vendorOne, REQ, { decision: "APPROVED", version }),
      error,
    );
    assert.equal(seen.audit, undefined);
  }
});

void test("a vendor previews only its own request, at the version it was assigned", async () => {
  let where: unknown;
  let download: unknown[] = [];
  const prisma = {
    vendorAssignment: {
      findFirst: (value: { where: { vendorUserId: bigint } }) => {
        where = value.where;
        return Promise.resolve(
          value.where.vendorUserId === 31n
            ? { documentVersion: 2, document: { publicId: DOC } }
            : null,
        );
      },
    },
  } as unknown as PrismaService;
  const files = {
    download: (...values: unknown[]) => {
      download = values;
      return Promise.resolve({ file: "stream" });
    },
  } as unknown as DocumentsService;
  const service = vendorWorkspace(prisma, files);
  await service.preview(vendorOne, REQ);
  assert.deepEqual(where, { tenantId: 7n, vendorUserId: 31n, publicId: REQ });
  assert.deepEqual(download.slice(1), [
    DOC,
    "preview",
    { caseScope: { tenantId: 7n }, version: 2 },
  ]);
  await assert.rejects(
    service.preview({ ...vendorOne, userId: 32n }, REQ),
    NotFoundException,
  );
});

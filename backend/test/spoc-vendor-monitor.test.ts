import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../src/database/prisma.service";
import type { DocumentsService } from "../src/documents/documents.service";
import {
  CLIENT_A,
  CLIENT_B,
  DOC,
  VENDOR_1,
  VENDOR_2,
  args,
  spocA,
  spocMonitor,
  type Args,
  type Seen,
} from "./helpers/vendor-fixtures";

function monitorPrisma(detailRow: unknown = null) {
  const seen: Seen = {};
  const record = (key: string, result: unknown) => (value: Args) => {
    seen[key] = value;
    return Promise.resolve(result);
  };
  const prisma = {
    client: {
      findFirst: record("client", {
        id: 21n,
        publicId: CLIENT_A,
        code: "A",
        displayName: "Client A",
        status: "ACTIVE",
      }),
      findMany: record("clients", [
        {
          id: 21n,
          publicId: CLIENT_A,
          code: "A",
          displayName: "Client A",
          status: "ACTIVE",
        },
      ]),
      count: () => Promise.resolve(1),
    },
    document: {
      findFirst: record("detail", detailRow),
      // The paged document list is ordered; the roll-up tally is not.
      findMany: (value: Args & { orderBy?: unknown }) => {
        if (value.orderBy) {
          seen.list = value;
          return Promise.resolve([]);
        }
        return Promise.resolve(
          [1, 2, 3, 4].map(() => ({ case: { clientId: 21n } })),
        );
      },
      count: () => Promise.resolve(0),
    },
    candidatePortalAccess: { findFirst: () => Promise.resolve(null) },
    documentVersion: {
      findMany: () =>
        Promise.resolve([
          { version: 3, createdAt: new Date(0), uploadedById: null },
        ]),
    },
    auditEvent: { findMany: () => Promise.resolve([]) },
    user: { findMany: () => Promise.resolve([]) },
    vendorAssignment: {
      findMany: record("attempts", [
        { clientId: 21n, documentId: 1n, attempt: 1, status: "REJECTED" },
        { clientId: 21n, documentId: 1n, attempt: 2, status: "PENDING" },
        { clientId: 21n, documentId: 2n, attempt: 1, status: "APPROVED" },
        { clientId: 21n, documentId: 3n, attempt: 1, status: "REJECTED" },
      ]),
    },
  };
  const files = {
    download: (...values: unknown[]) => {
      seen.download = values;
      return Promise.resolve({ file: "stream" });
    },
  } as unknown as DocumentsService;
  return {
    service: spocMonitor(prisma as unknown as PrismaService, files),
    seen,
  };
}

void test("SPOC-RM vendor reads, lists and previews are pinned to its own client", async () => {
  const { service, seen } = monitorPrisma();
  const page = { page: 1, pageSize: 20 };
  await assert.rejects(
    service.documents(spocA, CLIENT_B, page),
    ForbiddenException,
  );
  await service.documents(spocA, CLIENT_A, {
    ...page,
    vendorStatus: "REJECTED",
  });
  const where = args(seen, "list").where as {
    case: { clientId: bigint };
    AND: unknown[];
  };
  assert.equal(where.case.clientId, 21n);
  assert.equal(where.AND.length, 2);
  await assert.rejects(service.detail(spocA, DOC), NotFoundException);
  assert.deepEqual(args(seen, "detail").where?.case, {
    tenantId: 7n,
    clientId: { in: [21n] },
  });
  await service.preview(spocA, DOC);
  assert.deepEqual((seen.download as unknown[]).slice(1), [
    DOC,
    "preview",
    { caseScope: { tenantId: 7n, clientId: { in: [21n] } } },
  ]);
});

void test("the client roll-up counts each document by its latest vendor attempt", async () => {
  const { service } = monitorPrisma();
  const result = await service.clients(spocA, { page: 1, pageSize: 20 });
  assert.deepEqual(result.items[0], {
    id: CLIENT_A,
    code: "A",
    displayName: "Client A",
    status: "ACTIVE",
    uploaded: 4,
    notAssigned: 1,
    pending: 1,
    approved: 1,
    rejected: 1,
  });
});

void test("document detail returns the full history in order with the current state", async () => {
  const attempt = (
    n: number,
    status: string,
    extra: Record<string, unknown>,
  ) => ({
    publicId: `a${n}`,
    attempt: n,
    status,
    version: 1,
    documentVersion: n + 1,
    assignmentNote: null,
    resolutionNote: null,
    decisionReason: null,
    createdAt: new Date(n * 1000),
    decidedAt: null,
    assignedBy: { displayName: "Sam SPOC" },
    decidedBy: null,
    ...extra,
  });
  const { service } = monitorPrisma({
    publicId: DOC,
    type: "DEGREE_CERTIFICATE",
    status: "UPLOADED",
    currentVersion: 3,
    updatedAt: new Date(0),
    case: {
      publicId: "case-1",
      caseNumber: "SG-1001",
      status: "IN_PROGRESS",
      subject: { fullName: "Asha Rao" },
      client: { publicId: CLIENT_A, displayName: "Client A" },
    },
    versions: [
      {
        version: 3,
        originalName: "degree.pdf",
        contentType: "application/pdf",
        sizeBytes: 2048n,
        createdAt: new Date(0),
      },
    ],
    vendorAssignments: [
      attempt(1, "REJECTED", {
        decisionReason: "Seal is unreadable",
        decidedAt: new Date(1500),
        vendor: { publicId: VENDOR_1, displayName: "Acme Vendors" },
        decidedBy: { displayName: "Acme Vendors" },
      }),
      attempt(2, "PENDING", {
        resolutionNote: "Client uploaded a clear scan",
        vendor: { publicId: VENDOR_2, displayName: "Beta Checks" },
      }),
    ],
  });
  const detail = await service.detail(spocA, DOC);
  assert.equal(detail.vendorStatus, "PENDING");
  assert.equal(detail.canAssign, false);
  assert.equal(detail.canReassign, false);
  assert.equal(detail.file?.sizeBytes, "2048");
  assert.equal(detail.current?.vendor.name, "Beta Checks");
  assert.deepEqual(
    detail.history.map((row) => [
      row.attempt,
      row.status,
      row.reason,
      row.resolutionNote,
    ]),
    [
      [1, "REJECTED", "Seal is unreadable", null],
      [2, "PENDING", null, "Client uploaded a clear scan"],
    ],
  );
});

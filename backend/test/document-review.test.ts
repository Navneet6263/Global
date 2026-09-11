import assert from "node:assert/strict";
import test from "node:test";
import { DocumentReviewService } from "../src/documents/document-review.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { Actor } from "../src/common/auth/actor";

const actor = { tenantId: 1n, userId: 2n, roles: ["OPS_MANAGER"] } as Actor;
const input = {
  version: 4,
  documentVersion: 2,
  decision: "VERIFIED",
  note: "Checked full original document",
};

function fixture(patch: Record<string, unknown> = {}) {
  const events: unknown[] = [];
  const updates: unknown[] = [];
  const tx = {
    document: {
      findFirst: () =>
        Promise.resolve({
          id: 9n,
          currentVersion: 2,
          version: 4,
          status: "AVAILABLE",
          expiresAt: null,
          case: { id: 3n, publicId: "case-id", status: "IN_PROGRESS" },
          versions: [{ malwareState: "CLEAN" }],
          ...patch,
        }),
      updateMany: (args: unknown) => {
        updates.push(args);
        return Promise.resolve({ count: 1 });
      },
    },
    verificationCase: { updateMany: () => Promise.resolve({ count: 1 }) },
    auditEvent: {
      create: (args: unknown) => {
        events.push(args);
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    $transaction: (run: (client: typeof tx) => unknown) =>
      Promise.resolve(run(tx)),
  } as unknown as PrismaService;
  return { service: new DocumentReviewService(prisma), events, updates };
}

void test("review rejects stale reviewer or uploaded version without altering document", async () => {
  const { service, updates } = fixture({ currentVersion: 3 });
  await assert.rejects(service.review(actor, "doc-id", input), /changed/);
  assert.equal(updates.length, 0);
});

void test("manager-approved evidence cannot be silently changed", async () => {
  const { service, updates } = fixture({
    case: { id: 3n, publicId: "case-id", status: "PAYMENT_PENDING" },
  });
  await assert.rejects(
    service.review(actor, "doc-id", input),
    /Return or reopen/,
  );
  assert.equal(updates.length, 0);
});

void test("review refuses expired or unsafe evidence", async () => {
  await assert.rejects(
    fixture({ expiresAt: new Date("2020-01-01") }).service.review(
      actor,
      "doc-id",
      input,
    ),
    /expired/,
  );
  await assert.rejects(
    fixture({ versions: [{ malwareState: "PENDING" }] }).service.review(
      actor,
      "doc-id",
      input,
    ),
    /safe uploaded/,
  );
});

void test("accepted review records actual actor and exact file version", async () => {
  const { service, events, updates } = fixture();
  const result = await service.review(actor, "doc-id", input);
  assert.equal(result.version, 5);
  assert.equal(result.currentVersion, 2);
  assert.equal(updates.length, 1);
  const event = events[0] as {
    data: {
      tenantId: bigint;
      actorUserId: bigint;
      action: string;
      afterJson: string;
    };
  };
  assert.equal(event.data.tenantId, 1n);
  assert.equal(event.data.actorUserId, 2n);
  assert.equal(event.data.action, "document.verified");
  assert.equal(
    (JSON.parse(event.data.afterJson) as { documentVersion: number })
      .documentVersion,
    2,
  );
});

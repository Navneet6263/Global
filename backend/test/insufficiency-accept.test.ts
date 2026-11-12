import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import { acceptReplyDocuments } from "../src/clarifications/clarifications.service";
import type { Prisma } from "../src/generated/prisma/client";

const raised = new Date("2026-11-11T08:25:00Z");
const after = new Date("2026-11-11T08:27:00Z");
const before = new Date("2026-11-11T08:00:00Z");
const tl = {
  tenantId: 1n,
  userId: 147n,
  roles: ["VERIFIER"],
} as unknown as Actor;

const doc = (
  id: number,
  type: string,
  latest: { createdAt: Date; malwareState?: string },
  extra: Record<string, unknown> = {},
) => ({
  id: BigInt(id),
  publicId: `doc-${id}`,
  type,
  status: "AVAILABLE",
  version: 3,
  currentVersion: 2,
  expiresAt: null,
  versions: [{ version: 2, malwareState: "CLEAN", ...latest }],
  ...extra,
});

void test("the Team Leader's comment accepts only the documents sent in reply", async () => {
  const updates: Array<{ id: bigint; data: Record<string, unknown> }> = [];
  const audits: Array<Record<string, unknown>> = [];
  const tx = {
    document: {
      findMany: () =>
        Promise.resolve([
          doc(1, "AADHAAR", { createdAt: after }),
          // Uploaded before the insufficiency: not part of the reply.
          doc(2, "PAN", { createdAt: before }),
          // Not clean yet.
          doc(3, "PASSPORT", { createdAt: after, malwareState: "PENDING" }),
          // Expired: never accepted.
          doc(
            4,
            "DRIVING_LICENCE",
            { createdAt: after },
            { expiresAt: new Date("2020-01-01") },
          ),
        ]),
      updateMany: (args: {
        where: { id: bigint };
        data: Record<string, unknown>;
      }) => {
        updates.push({ id: args.where.id, data: args.data });
        return Promise.resolve({ count: 1 });
      },
    },
    auditEvent: {
      create: (args: { data: Record<string, unknown> }) => {
        audits.push(args.data);
        return Promise.resolve({});
      },
    },
  } as unknown as Prisma.TransactionClient;

  const accepted = await acceptReplyDocuments(tx, tl, {
    caseId: 30n,
    casePublicId: "case-1",
    since: raised,
    note: "New Aadhaar copy is clear and matches",
  });

  assert.deepEqual(accepted, ["AADHAAR"]);
  assert.equal(updates.length, 1);
  assert.equal(updates[0]!.id, 1n);
  assert.equal(updates[0]!.data.status, "VERIFIED");
  assert.equal(
    updates[0]!.data.reviewNote,
    "New Aadhaar copy is clear and matches",
  );
  assert.equal(updates[0]!.data.reviewedById, 147n);
  // Audited like a normal document review.
  assert.equal(audits.length, 1);
  assert.equal(audits[0]!.action, "document.verified");
  assert.match(String(audits[0]!.afterJson), /insufficiency-resolved/);
});

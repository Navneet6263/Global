import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { VerificationMethodsService } from "../src/verification/verification-methods.service";

const actor = { userId: 10n, tenantId: 1n, roles: ["VERIFIER"] } as Actor;
const check = {
  id: 2n,
  caseId: 3n,
  status: "IN_PROGRESS",
  case: { id: 3n, publicId: "case", status: "IN_PROGRESS", version: 1 },
};
const input = {
  version: 1,
  result: "CLEAR",
  summary: "Reviewed the original authorised source",
  evidenceIds: [],
  evidenceVersions: [],
};

void test("whitespace-only source summary is rejected before any persistence", async () => {
  const service = new VerificationMethodsService({} as PrismaService);
  await assert.rejects(
    service.respond(actor, "check", "method", {
      ...input,
      summary: "                 ",
    }),
    /factual source summary/,
  );
});

void test("source responses recheck verifier ownership after the case lock", async () => {
  const reads: string[] = [];
  const tx = {
    verificationCase: {
      updateMany: () => {
        reads.push("case-lock");
        return Promise.resolve({ count: 1 });
      },
    },
    caseCheck: {
      findFirst: () => {
        reads.push("ownership-recheck");
        return Promise.resolve(null);
      },
    },
  };
  const prisma = {
    caseCheck: { findFirst: () => Promise.resolve(check) },
    $transaction: (work: (db: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  await assert.rejects(
    new VerificationMethodsService(prisma).respond(
      actor,
      "check",
      "method",
      input,
    ),
    /not found or not assigned/,
  );
  assert.deepEqual(reads, ["case-lock", "ownership-recheck"]);
});

void test("source method API keeps document IDs compatible while persisting exact versions", async () => {
  let data: unknown;
  const tx = {
    verificationCase: { updateMany: () => Promise.resolve({ count: 1 }) },
    caseCheck: { findFirst: () => Promise.resolve(check) },
    document: {
      findMany: () =>
        Promise.resolve([{ publicId: "document", currentVersion: 3 }]),
    },
    verificationMethodRun: {
      findFirst: () =>
        Promise.resolve({
          id: 4n,
          method: "DIGITAL",
          status: "REQUESTED",
          version: 1,
        }),
      updateMany: (value: unknown) => {
        data = value;
        return Promise.resolve({ count: 1 });
      },
    },
    auditEvent: { create: () => Promise.resolve({}) },
  };
  const prisma = {
    caseCheck: { findFirst: () => Promise.resolve(check) },
    $transaction: (work: (db: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  await new VerificationMethodsService(prisma).respond(
    actor,
    "check",
    "method",
    {
      ...input,
      reference: "source-reference",
      evidenceIds: ["document"],
      evidenceVersions: [{ documentId: "document", version: 3 }],
    },
  );
  assert.deepEqual(
    JSON.parse((data as { data: { evidenceJson: string } }).data.evidenceJson),
    [{ documentId: "document", version: 3 }],
  );
});

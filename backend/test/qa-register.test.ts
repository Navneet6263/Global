import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { QaRegisterQueryDto } from "../src/qa/dto/qa-register-query.dto";
import {
  qaRegisterWhere,
  readQaDetail,
  readQaRegister,
} from "../src/qa/qa-register";
import { readQaHistory } from "../src/qa/qa-history-reader";

const actor = { tenantId: 1n, userId: 2n, branchId: 3n, clientId: 4n } as Actor;
const now = new Date("2026-09-05T10:00:00Z");

void test("every QA view composes search and ownership with tenant, branch and client scope", () => {
  for (const view of ["all", "available", "mine", "corrections"] as const) {
    const query = Object.assign(new QaRegisterQueryDto(), {
      search: "candidate",
      view,
    });
    const where = qaRegisterWhere(actor, query, now);
    assert.deepEqual(where.AND[0], {
      tenantId: 1n,
      branchId: 3n,
      clientId: 4n,
    });
    assert.ok(where.AND[3].OR);
    if (view === "mine")
      assert.deepEqual(where.AND[2], {
        qaReviewerId: 2n,
        qaClaimedAt: { gt: new Date("2026-09-05T09:30:00Z") },
      });
    if (view === "available")
      assert.deepEqual(where.AND[2].OR?.at(-1), {
        qaClaimedAt: { lte: new Date("2026-09-05T09:30:00Z") },
      });
    if (view === "corrections")
      assert.deepEqual(where.AND[2].qaReviews, {
        some: { decision: "REWORK" },
      });
  }
});

void test("QA register reads bounded summary rows without document payloads or findings", async () => {
  let selected: Record<string, unknown> = {};
  let rowWhere: unknown;
  const countWhere: unknown[] = [];
  const db = {
    verificationCase: {
      findMany: (input: {
        where: unknown;
        select: Record<string, unknown>;
        skip: number;
        take: number;
      }) => {
        selected = input.select;
        rowWhere = input.where;
        assert.equal(input.skip, 10);
        assert.equal(input.take, 10);
        return Promise.resolve([
          {
            publicId: "case-1",
            status: "QA_REVIEW",
            qaReviewer: null,
            qaClaimedAt: null,
            checks: [{ riskLevel: null, status: "COMPLETED" }],
            _count: { documents: 400 },
            qaReviews: [],
          },
        ]);
      },
      count: (input: { where: unknown }) => {
        countWhere.push(input.where);
        return Promise.resolve(31);
      },
    },
  } as unknown as PrismaService;
  const result = await readQaRegister(
    db,
    actor,
    Object.assign(new QaRegisterQueryDto(), { page: 2, limit: 10 }),
  );
  assert.deepEqual(countWhere[0], rowWhere);
  assert.equal(selected.documents, undefined);
  assert.equal(selected.fieldVisits, undefined);
  assert.deepEqual(selected.checks, {
    select: { riskLevel: true, status: true },
  });
  assert.equal(result.total, 31);
  assert.equal(result.items[0]?.documentCount, 400);
  assert.equal(
    result.items[0]?.highestRisk,
    null,
    "unrecorded risk is not labelled low",
  );
  assert.equal(result.items[0]?.claimActive, false);
});

void test("QA detail is scope checked and rejects a case that left the QA gate", async () => {
  let row: { publicId: string; status: string } | null = null;
  const db = {
    verificationCase: {
      findFirst: (input: { where: { AND: unknown[] } }) => {
        assert.deepEqual(input.where.AND, [
          { tenantId: 1n, branchId: 3n, clientId: 4n },
          { publicId: "case-1" },
        ]);
        return Promise.resolve(row);
      },
    },
  } as unknown as PrismaService;
  await assert.rejects(readQaDetail(db, actor, "case-1"), NotFoundException);
  row = { publicId: "case-1", status: "COMPLETED" };
  await assert.rejects(readQaDetail(db, actor, "case-1"), ConflictException);
  row = { publicId: "case-1", status: "QA_REVIEW" };
  assert.equal((await readQaDetail(db, actor, "case-1")).id, "case-1");
});

void test("decision history is bounded, scoped and belongs only to its reviewer", async () => {
  let queriedWhere: unknown;
  const db = {
    qaReview: {
      findMany: (input: { where: unknown; take: number; skip: number }) => {
        queriedWhere = input.where;
        assert.equal(input.take, 5);
        assert.equal(input.skip, 10);
        return Promise.resolve([]);
      },
      count: (input: { where: unknown }) => {
        assert.deepEqual(input.where, queriedWhere);
        return Promise.resolve(0);
      },
    },
  } as unknown as PrismaService;
  await readQaHistory(
    db,
    actor,
    Object.assign(new QaRegisterQueryDto(), { page: 3, limit: 5 }),
  );
  assert.deepEqual(queriedWhere, {
    reviewerId: 2n,
    case: { AND: [{ tenantId: 1n, branchId: 3n, clientId: 4n }, {}] },
  });
});

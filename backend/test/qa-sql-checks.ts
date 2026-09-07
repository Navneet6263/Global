import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { Prisma } from "../src/generated/prisma/client";
import { QaRegisterQueryDto } from "../src/qa/dto/qa-register-query.dto";
import { readQaDetail, readQaRegister } from "../src/qa/qa-register";
import { readQaHistory } from "../src/qa/qa-history-reader";

// Called inside the existing rollback-only integration transaction, never seeds live UI.
export async function verifyQaSql(
  tx: Prisma.TransactionClient,
  actor: Actor,
  clientActor: Actor,
  cases: Array<{ id: bigint; publicId: string }>,
) {
  const [first, second, foreign] = cases;
  assert.ok(first && second && foreign);
  const db = tx as unknown as PrismaService;
  await tx.verificationCase.updateMany({
    where: { id: { in: cases.map((item) => item.id) } },
    data: { status: "QA_REVIEW" },
  });
  const reviewer = await tx.user.create({
    data: {
      tenantId: actor.tenantId,
      email: "qa-integration@example.invalid",
      normalizedEmail: "qa-integration@example.invalid",
      displayName: "Integration reviewer",
      passwordHash: "unusable-integration-password",
      status: "SUSPENDED",
    },
  });
  const qaActor = { ...actor, userId: reviewer.id };
  await tx.verificationCase.update({
    where: { id: first.id },
    data: { qaReviewerId: reviewer.id, qaClaimedAt: new Date() },
  });
  const query = new QaRegisterQueryDto();
  const queue = await readQaRegister(db, qaActor, query);
  assert.equal(queue.total, 2);
  assert.equal(queue.summary.awaiting, 2);
  assert.equal(queue.summary.claimed, 1);
  assert.equal(
    queue.items.some((item) => item.id === foreign.publicId),
    false,
  );
  assert.deepEqual(
    (await readQaRegister(db, clientActor, query)).items.map((item) => item.id),
    [first.publicId],
  );
  assert.deepEqual(
    (await readQaRegister(db, qaActor, { ...query, view: "mine" })).items.map(
      (item) => item.id,
    ),
    [first.publicId],
  );
  assert.deepEqual(
    (
      await readQaRegister(db, qaActor, { ...query, view: "available" })
    ).items.map((item) => item.id),
    [second.publicId],
  );
  assert.equal(
    (await readQaDetail(db, qaActor, first.publicId)).id,
    first.publicId,
  );
  await assert.rejects(
    readQaDetail(db, qaActor, foreign.publicId),
    NotFoundException,
  );
  await assert.rejects(
    readQaDetail(db, clientActor, second.publicId),
    NotFoundException,
  );
  const branch = await tx.branch.create({
    data: {
      tenantId: actor.tenantId,
      code: "QA-ISOLATION",
      name: "QA isolation branch",
    },
  });
  await tx.verificationCase.update({
    where: { id: second.id },
    data: { branchId: branch.id },
  });
  assert.deepEqual(
    (
      await readQaRegister(db, { ...qaActor, branchId: branch.id }, query)
    ).items.map((item) => item.id),
    [second.publicId],
  );
  await tx.qaReview.create({
    data: {
      caseId: first.id,
      reviewerId: reviewer.id,
      decision: "REWORK",
      notes: "Please verify the employment source again",
      checklistJson: "[]",
    },
  });
  await tx.verificationCase.update({
    where: { id: first.id },
    data: { status: "IN_PROGRESS", qaReviewerId: null, qaClaimedAt: null },
  });
  const corrections = await readQaRegister(db, qaActor, {
    ...query,
    view: "corrections",
  });
  assert.equal(corrections.total, 1);
  assert.equal(
    corrections.items[0]?.correctionReason,
    "Please verify the employment source again",
  );
  const history = await readQaHistory(db, qaActor, query);
  assert.equal(history.total, 1);
  assert.equal(history.items[0]?.case.status, "IN_PROGRESS");
  assert.equal(
    (await readQaHistory(db, actor, query)).total,
    0,
    "another reviewer cannot see this as their own history",
  );
  assert.equal(
    (await readQaHistory(db, { ...qaActor, branchId: branch.id }, query)).total,
    0,
  );
}

import assert from "node:assert/strict";
import type { Prisma } from "../../src/generated/prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import { BulkTaskAssignmentService } from "../../src/verification/bulk-task-assignment.service";
import { TaskWorkflowService } from "../../src/verification/task-workflow.service";
import { VerificationMethodsService } from "../../src/verification/verification-methods.service";
import { QaReadinessService } from "../../src/verification/qa-readiness.service";
import { ClarificationsService } from "../../src/clarifications/clarifications.service";
import { ClarificationTokenService } from "../../src/clarifications/clarification-token.service";
import { proofFile, type intakeSourceFixture } from "./intake-source-fixture";

export async function sourceMethodScenario(
  tx: Prisma.TransactionClient,
  db: PrismaService,
  f: Awaited<ReturnType<typeof intakeSourceFixture>>,
) {
  const checks = await tx.caseCheck.findMany({
    where: { caseId: f.row.id },
    orderBy: { id: "asc" },
  });
  await new BulkTaskAssignmentService(db).assign(f.manager, {
    assigneeId: f.verifier.userPublicId,
    mode: "ASSIGN",
    items: checks.map((check) => ({ checkId: check.publicId })),
  });
  const ready = new QaReadinessService();
  const tasks = new TaskWorkflowService(db, ready);
  const methods = new VerificationMethodsService(db);
  const first = checks[0]!;
  const task = await tx.checkTask.findFirstOrThrow({
    where: { checkId: first.id },
  });
  await tasks.update(f.verifier, task.publicId, {
    version: task.version,
    status: "IN_PROGRESS",
    findings: [],
  });
  for (const method of ["MANUAL", "DIGITAL", "THIRD_PARTY"])
    await methods.create(f.verifier, first.publicId, {
      method,
      provider: "Synthetic recorded source - no provider call",
      sourceContact: "internal-test-reference",
    });
  await assert.rejects(
    methods.create(
      { ...f.verifier, userId: f.finance.userId },
      first.publicId,
      { method: "MANUAL" },
    ),
    /not found or not assigned/,
  );
  const currentTask = () =>
    tx.checkTask.findUniqueOrThrow({ where: { id: task.id } });
  await assert.rejects(
    tasks.update(f.verifier, task.publicId, {
      version: (await currentTask()).version,
      status: "COMPLETED",
      result: "CLEAR",
      sourceSummary: "Outstanding sources must block completion",
      findings: [],
    }),
    /outstanding source-method/,
  );
  const respond = async (
    checkId: string,
    evidenceId: string,
    fileVersion: number,
  ) => {
    const listed = await methods.list(f.verifier, checkId);
    assert.equal(listed.digitalMode, "RECORDED_EVIDENCE");
    for (const run of listed.items.filter(
      (item) => item.status === "REQUESTED",
    ))
      await methods.respond(f.verifier, checkId, run.id, {
        version: run.version,
        result: "CLEAR",
        summary:
          "Synthetic recorded source matched the reviewed evidence version.",
        reference: "SYNTHETIC-REFERENCE",
        evidenceIds: [evidenceId],
        evidenceVersions: [{ documentId: evidenceId, version: fileVersion }],
      });
  };
  const evidenceId = f.documentIds[0]!;
  await respond(first.publicId, evidenceId, 1);
  const recorded = await tx.verificationMethodRun.findFirstOrThrow({
    where: { checkId: first.id, method: "DIGITAL" },
  });
  assert.deepEqual(JSON.parse(recorded.evidenceJson), [
    { documentId: evidenceId, version: 1 },
  ]);
  const replacement = await proofFile("corrected-employment-v2");
  await f.documents.upload(f.manager, evidenceId, replacement);
  const document = await tx.document.findUniqueOrThrow({
    where: { publicId: evidenceId },
  });
  await f.reviews.review(f.manager, evidenceId, {
    version: document.version,
    documentVersion: 2,
    decision: "VERIFIED",
    note: "Corrected synthetic evidence independently reviewed.",
  });
  await assert.rejects(
    tasks.update(f.verifier, task.publicId, {
      version: (await currentTask()).version,
      status: "COMPLETED",
      result: "CLEAR",
      sourceSummary: "Old source results must not certify replacement bytes",
      findings: [],
    }),
    /Source evidence changed/,
  );
  const clarifications = new ClarificationsService(
    db,
    new ClarificationTokenService(db),
    ready,
  );
  const correction = await clarifications.create(f.manager, f.row.publicId, {
    checkId: first.publicId,
    subject: "Source evidence replaced",
    message: "Confirm corrected evidence before controlled re-verification.",
  });
  await clarifications.respond(
    correction.id,
    correction.portalToken,
    "Synthetic correction confirmed; use the replacement proof version.",
  );
  await clarifications.resolve(
    f.manager,
    f.row.publicId,
    correction.id,
    "Candidate response reviewed; re-run every original method.",
  );
  assert.equal(
    await tx.verificationMethodRun.count({
      where: { checkId: first.id, status: "SUPERSEDED" },
    }),
    3,
  );
  const restarted = (await methods.list(f.verifier, first.publicId)).items.find(
    (item) => item.status === "REQUESTED",
  )!;
  await assert.rejects(
    methods.respond(f.verifier, first.publicId, restarted.id, {
      version: restarted.version,
      result: "CLEAR",
      summary: "Stale browser selection must be rejected after replacement.",
      reference: "SYNTHETIC-REFERENCE",
      evidenceIds: [evidenceId],
      evidenceVersions: [{ documentId: evidenceId, version: 1 }],
    }),
    /changed after you opened/,
  );
  await respond(first.publicId, evidenceId, 2);
  let active = await currentTask();
  await tasks.update(f.verifier, active.publicId, {
    version: active.version,
    status: "IN_PROGRESS",
    findings: [],
  });
  active = await currentTask();
  await tasks.update(f.verifier, active.publicId, {
    version: active.version,
    status: "COMPLETED",
    result: "CLEAR",
    sourceSummary:
      "Corrected evidence and all three source methods re-verified.",
    findings: [],
  });
  const second = checks[1]!;
  const secondTask = await tx.checkTask.findFirstOrThrow({
    where: { checkId: second.id },
  });
  await tasks.update(f.verifier, secondTask.publicId, {
    version: secondTask.version,
    status: "IN_PROGRESS",
    findings: [],
  });
  await methods.create(f.verifier, second.publicId, { method: "MANUAL" });
  await respond(second.publicId, f.documentIds[1]!, 1);
  const secondActive = await tx.checkTask.findUniqueOrThrow({
    where: { id: secondTask.id },
  });
  await tasks.update(f.verifier, secondTask.publicId, {
    version: secondActive.version,
    status: "COMPLETED",
    result: "CLEAR",
    sourceSummary:
      "Second service required proof and source manually reviewed.",
    findings: [],
  });
  assert.equal(
    (await tx.verificationCase.findUniqueOrThrow({ where: { id: f.row.id } }))
      .status,
    "QA_REVIEW",
  );
  const notifications = await tx.notification.findMany({
    where: { tenantId: f.tenant.id, type: "QA_READY" },
    select: { userId: true, href: true },
  });
  assert.ok(
    notifications.some(
      (item) => item.userId === f.qa.userId && item.href === "/qa-review",
    ),
  );
  assert.ok(
    notifications.some(
      (item) =>
        item.userId === f.manager.userId && item.href === "/operations/cases",
    ),
  );
}

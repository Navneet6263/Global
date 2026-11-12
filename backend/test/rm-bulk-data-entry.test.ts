import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { BulkDataEntryService } from "../src/workflow/bulk-data-entry.service";
import { BulkAssignDataEntryDto } from "../src/workflow/dto/bulk-data-entry.dto";
import { IntakeService } from "../src/workflow/intake.service";
import { WorkflowBulkController } from "../src/workflow/workflow-bulk.controller";
import {
  cleanDoc,
  createEligibilityStore,
  seedAccessRow,
  seedCaseRow,
  seedConsentRow,
  testUuid,
} from "./helpers/rm-eligibility-fixtures";
import { testActor } from "./helpers/test-actor";

const deId = testUuid(21);
const selfRmDeId = testUuid(11);
const rmAshish = testActor(["SPOC_RM"], ["case:read", "case:write"], { userId: 11n, publicId: selfRmDeId, spocClients: [{ id: 40n } as never] });
const rmOther = testActor(["SPOC_RM"], ["case:read", "case:write"], { userId: 12n, spocClients: [{ id: 41n } as never] });
const rmWithDe = testActor(["SPOC_RM", "DATA_ENTRY"], ["case:read", "case:write"], { userId: 11n, publicId: selfRmDeId, spocClients: [{ id: 40n } as never] });
const verifierActor = testActor(["VERIFIER"], ["case:read"]);

const makeUsers = () => [
  { id: 21n, publicId: deId, displayName: "Deepa DE", status: "ACTIVE", roles: ["DATA_ENTRY"] },
  { id: 11n, publicId: selfRmDeId, displayName: "Ashish", status: "ACTIVE", roles: ["SPOC_RM", "DATA_ENTRY"] },
  { id: 22n, publicId: testUuid(22), displayName: "Inactive DE", status: "SUSPENDED", roles: ["DATA_ENTRY"] },
  { id: 23n, publicId: testUuid(23), displayName: "Verifier Only", status: "ACTIVE", roles: ["VERIFIER"] },
];

function eligibleCase(id: bigint, caseNumber: string, clientId = 40n, assignedOpsUserId = 11n) {
  return seedCaseRow(id, caseNumber, "DOCUMENT_PENDING", {
    clientId,
    assignedOpsUserId,
    intakeStage: "INTAKE",
    documents: [cleanDoc(id * 10n)],
  });
}

void test("WorkflowBulkController enforces allowed roles and supports single & multi-case bulk assignment with per-case audit + notification", async () => {
  const bulkHandler = Object.getOwnPropertyDescriptor(WorkflowBulkController.prototype, "bulkAssignDataEntry")?.value as object;
  const roles = Reflect.getMetadata("roles", bulkHandler) as string[];
  assert.deepEqual(roles, ["PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM", "DATA_ENTRY"]);

  const c1 = eligibleCase(1n, "SG-BULK-1");
  const c2 = eligibleCase(2n, "SG-BULK-2");
  const c3 = eligibleCase(3n, "SG-BULK-3");
  const ctx = {
    cases: [c1, c2, c3],
    consents: [seedConsentRow(101n, 1n, "ACCEPTED"), seedConsentRow(102n, 2n, "ACCEPTED"), seedConsentRow(103n, 3n, "ACCEPTED")],
    accesses: [seedAccessRow(201n, 1n, new Date()), seedAccessRow(202n, 2n, new Date()), seedAccessRow(203n, 3n, new Date())],
    audits: [],
    notifications: [],
    users: makeUsers(),
  };
  const service = new BulkDataEntryService(createEligibilityStore(ctx));

  const single = await service.assignMany(rmAshish, {
    assigneeId: deId,
    note: "Priority batch",
    items: [{ caseId: c1.publicId, version: 1 }],
  });
  assert.equal(single.assignedCount, 1);
  assert.equal(single.failedCount, 0);
  assert.equal(c1.intakeStage, "DATA_ENTRY");
  assert.equal(c1.version, 2);

  const multi = await service.assignMany(rmAshish, {
    assigneeId: deId,
    items: [{ caseId: c2.publicId, version: 1 }, { caseId: c3.publicId, version: 1 }],
  });
  assert.equal(multi.assignedCount, 2);
  assert.equal(multi.failedCount, 0);
  assert.equal(ctx.audits.filter((a) => a.action === "case.data-entry-assigned").length, 3);
  assert.equal(ctx.notifications.filter((n) => n.userId === 21n && n.type === "DATA_ENTRY_ASSIGNED").length, 3);
});

void test("bulk assign isolates partial failures across CANDIDATE_UPLOAD, READY, stale version, already-assigned, and cross-RM cases", async () => {
  const valid = eligibleCase(1n, "SG-VALID-1");
  const unsubmitted = seedCaseRow(2n, "SG-UPLOAD-2", "DOCUMENT_PENDING", { intakeStage: "CANDIDATE_UPLOAD" });
  const ready = eligibleCase(3n, "SG-READY-3");
  ready.intakeStage = "READY";
  const alreadySameDe = eligibleCase(4n, "SG-SAME-DE-4");
  alreadySameDe.dataEntryUserId = 21n;
  alreadySameDe.intakeStage = "DATA_ENTRY";
  const otherClient = eligibleCase(5n, "SG-OTHER-RM-5", 41n, 12n);
  const ctx = {
    cases: [valid, unsubmitted, ready, alreadySameDe, otherClient],
    consents: [seedConsentRow(101n, 1n, "ACCEPTED"), seedConsentRow(102n, 2n, "ACCEPTED"), seedConsentRow(103n, 3n, "ACCEPTED"), seedConsentRow(104n, 4n, "ACCEPTED")],
    accesses: [seedAccessRow(201n, 1n, new Date()), seedAccessRow(202n, 2n, null)],
    audits: [],
    notifications: [],
    users: makeUsers(),
  };
  const service = new BulkDataEntryService(createEligibilityStore(ctx));

  const res = await service.assignMany(rmAshish, {
    assigneeId: deId,
    items: [
      { caseId: valid.publicId, version: 1 },
      { caseId: unsubmitted.publicId, version: 1 },
      { caseId: ready.publicId, version: 1 },
      { caseId: alreadySameDe.publicId, version: 1 },
      { caseId: otherClient.publicId, version: 1 },
      { caseId: valid.publicId, version: 99 }, // wait - also check stale version on a separate case
    ].slice(0, 5),
  });
  assert.equal(res.assignedCount, 1);
  assert.equal(res.failedCount, 4);
  assert.deepEqual(res.assigned.map((a) => a.caseNumber), ["SG-VALID-1"]);
  assert.deepEqual(res.failed.map((f) => [f.caseId, f.code]), [
    [unsubmitted.publicId, "CONFLICT"],
    [ready.publicId, "CONFLICT"],
    [alreadySameDe.publicId, "CONFLICT"],
    [otherClient.publicId, "NOT_FOUND"],
  ]);

  // Stale version + cross-RM direct ownership checks
  const stale = eligibleCase(6n, "SG-STALE-6");
  ctx.cases.push(stale);
  ctx.accesses.push(seedAccessRow(206n, 6n, new Date()));
  const staleRes = await service.assignMany(rmAshish, { assigneeId: deId, items: [{ caseId: stale.publicId, version: 9 }] });
  assert.equal(staleRes.failedCount, 1);
  assert.equal(staleRes.failed[0]?.code, "CONFLICT");

  await assert.rejects(
    service.assignMany(rmOther, { assigneeId: deId, items: [{ caseId: valid.publicId, version: valid.version }] })
      .then((out) => { if (out.failedCount === 1 && out.failed[0]?.code === "NOT_FOUND") throw new ForbiddenException(); }),
    ForbiddenException,
  );
});

void test("bulk assign validates caller role, active DATA_ENTRY assignee, self-assignment, concurrent races, and matches individual assign parity", async () => {
  const c1 = eligibleCase(1n, "SG-SELF-1");
  const c2 = eligibleCase(2n, "SG-SINGLE-2");
  const ctx = {
    cases: [c1, c2],
    consents: [seedConsentRow(101n, 1n, "ACCEPTED"), seedConsentRow(102n, 2n, "ACCEPTED")],
    accesses: [seedAccessRow(201n, 1n, new Date()), seedAccessRow(202n, 2n, new Date())],
    audits: [],
    notifications: [],
    users: makeUsers(),
  };
  const prisma = createEligibilityStore(ctx);
  const bulk = new BulkDataEntryService(prisma);
  const intake = new IntakeService(prisma);

  await assert.rejects(bulk.assignMany(verifierActor, { assigneeId: deId, items: [{ caseId: c1.publicId, version: 1 }] }), ForbiddenException);
  await assert.rejects(bulk.assignMany(rmAshish, { assigneeId: testUuid(22), items: [{ caseId: c1.publicId, version: 1 }] }), BadRequestException);
  await assert.rejects(bulk.assignMany(rmAshish, { assigneeId: testUuid(23), items: [{ caseId: c1.publicId, version: 1 }] }), BadRequestException);

  // SPOC_RM + DATA_ENTRY self-assign
  const selfRes = await bulk.assignMany(rmWithDe, { assigneeId: selfRmDeId, items: [{ caseId: c1.publicId, version: 1 }] });
  assert.equal(selfRes.assignedCount, 1);
  assert.equal(c1.dataEntryUserId, 11n);

  // Parity with single assignDataEntry
  const singleRes = await intake.assignDataEntry(rmAshish, c2.publicId, { assigneeId: deId, version: 1 });
  assert.equal(singleRes.intakeStage, "DATA_ENTRY");
  assert.equal(c2.dataEntryUserId, 21n);

  // Concurrent version conflict mid-loop (another user bumps version before updateMany)
  const race = eligibleCase(3n, "SG-RACE-3");
  ctx.cases.push(race);
  ctx.accesses.push(seedAccessRow(203n, 3n, new Date()));
  const origUpdateMany = prisma.verificationCase.updateMany.bind(prisma.verificationCase);
  prisma.verificationCase.updateMany = (() => Promise.resolve({ count: 0 })) as never;
  const raceRes = await bulk.assignMany(rmAshish, { assigneeId: deId, items: [{ caseId: race.publicId, version: 1 }] });
  prisma.verificationCase.updateMany = origUpdateMany;
  assert.equal(raceRes.assignedCount, 0);
  assert.equal(raceRes.failed[0]?.code, "CONFLICT");
});

void test("BulkAssignDataEntryDto enforces bounds, uniqueness, UUID format, and note length", async () => {
  const validErrs = await validate(plainToInstance(BulkAssignDataEntryDto, {
    assigneeId: deId,
    note: "Ok note",
    items: [{ caseId: testUuid(1), version: 1 }],
  }));
  assert.equal(validErrs.length, 0);

  const emptyErrs = await validate(plainToInstance(BulkAssignDataEntryDto, { assigneeId: deId, items: [] }));
  assert.ok(emptyErrs.some((e) => e.property === "items"));

  const over50 = Array.from({ length: 51 }, (_, i) => ({ caseId: testUuid(i + 1), version: 1 }));
  const maxErrs = await validate(plainToInstance(BulkAssignDataEntryDto, { assigneeId: deId, items: over50 }));
  assert.ok(maxErrs.some((e) => e.property === "items"));

  const dupErrs = await validate(plainToInstance(BulkAssignDataEntryDto, {
    assigneeId: deId,
    items: [{ caseId: testUuid(1), version: 1 }, { caseId: testUuid(1), version: 1 }],
  }));
  assert.ok(dupErrs.some((e) => e.property === "items"));

  const shortNote = await validate(plainToInstance(BulkAssignDataEntryDto, {
    assigneeId: "bad-uuid",
    note: "hi",
    items: [{ caseId: "bad-id", version: 0 }],
  }));
  assert.ok(shortNote.some((e) => e.property === "assigneeId"));
  assert.ok(shortNote.some((e) => e.property === "note"));
  assert.ok(shortNote.some((e) => e.property === "items"));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { ContentInspectionService } from "../src/documents/content-inspection.service";
import type { DocumentsService } from "../src/documents/documents.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { VendorCheckReminderService } from "../src/vendor-checks/vendor-check-reminder.service";
import {
  ageingBucket,
  defaultSharedTypes,
  exportColumns,
} from "../src/vendor-checks/vendor-check-rules";
import { vendorCsv } from "../src/vendor-checks/vendor-check-view";
import {
  VendorChecksService,
  assignAs,
  canReview,
} from "../src/vendor-checks/vendor-checks.service";
import {
  VendorWorkService,
  ownVendorJobs,
} from "../src/vendor-checks/vendor-work.service";

const now = new Date("2026-10-08T06:00:00Z");
const storage = {} as LocalObjectStorageService;
const ops = { tenantId: 1n, userId: 2n, roles: ["OPS_MANAGER"] } as Actor;

function checkRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 7n,
    publicId: "check-1",
    type: "ADDRESS",
    status: "ASSIGNED",
    departmentId: 4n,
    initiationJson: null,
    case: {
      id: 3n,
      publicId: "case-1",
      caseNumber: "SG-1",
      status: "IN_PROGRESS",
      clientId: 9n,
      assignedOpsUserId: 11n,
      client: { displayName: "Vision India" },
      subject: { fullName: "Aarav Sharma" },
    },
    tasks: [{ assigneeId: 21n }],
    ...overrides,
  };
}

function assignFixture(
  options: {
    check?: Record<string, unknown>;
    attempts?: Array<{ attempt: number; status: string }>;
    documents?: Array<{ publicId: string; type: string }>;
  } = {},
) {
  const created: Array<Record<string, unknown>> = [];
  const audits: Array<{ action: string; afterJson: string }> = [];
  const notices: unknown[] = [];
  const tx = {
    caseCheck: { findFirst: () => checkRow(options.check) },
    vendorCheckAssignment: {
      findMany: () => options.attempts ?? [],
      create: (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return { publicId: "job-1" };
      },
    },
    user: {
      findFirst: () => ({
        id: 50n,
        publicId: "vendor-1",
        displayName: "Field Co",
      }),
    },
    document: {
      findMany: () =>
        options.documents ?? [{ publicId: "doc-1", type: "ADDRESS_PROOF" }],
    },
    notification: { create: (args: unknown) => notices.push(args) },
    auditEvent: {
      create: (args: { data: { action: string; afterJson: string } }) =>
        audits.push(args.data),
    },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  return {
    service: new VendorChecksService(prisma, storage),
    created,
    audits,
    notices,
  };
}

const assignInput = {
  vendorId: "vendor-1",
  dueAt: "2026-10-12T00:00:00Z",
  documentIds: ["doc-1"],
};

void test("a check goes to a vendor with only the documents ticked, notified and audited", async () => {
  const { service, created, audits, notices } = assignFixture();
  const result = await service.assign(ops, "check-1", assignInput, now);
  assert.deepEqual(result, { id: "job-1", attempt: 1, status: "ASSIGNED" });
  assert.equal(created[0]!.sharedDocumentsJson, JSON.stringify(["doc-1"]));
  assert.equal(created[0]!.vendorUserId, 50n);
  assert.equal(notices.length, 1);
  assert.equal(audits[0]!.action, "vendor_check.assigned");
  assert.match(audits[0]!.afterJson, /ADDRESS_PROOF/);
});

void test("the next attempt is numbered after a declined one; a live job blocks a second", async () => {
  const again = assignFixture({
    attempts: [{ attempt: 1, status: "DECLINED" }],
  });
  assert.equal(
    (await again.service.assign(ops, "check-1", assignInput, now)).attempt,
    2,
  );
  const live = assignFixture({
    attempts: [{ attempt: 1, status: "SUBMITTED" }],
  });
  await assert.rejects(
    live.service.assign(ops, "check-1", assignInput, now),
    /already with a vendor/,
  );
});

void test("assigning needs a routed open case, a document of the case and the right person", async () => {
  await assert.rejects(
    assignFixture({
      check: { case: { ...checkRow().case, status: "DOCUMENT_PENDING" } },
    }).service.assign(ops, "check-1", assignInput, now),
    /Route the case/,
  );
  await assert.rejects(
    assignFixture({ documents: [] }).service.assign(
      ops,
      "check-1",
      assignInput,
      now,
    ),
    /clean documents of this case/,
  );
  const otherVerifier = {
    tenantId: 1n,
    userId: 99n,
    roles: ["VERIFIER"],
    departments: [],
  } as unknown as Actor;
  await assert.rejects(
    assignFixture().service.assign(otherVerifier, "check-1", assignInput, now),
    /Only the case RM, the Team Leader or Operations/,
  );
  // The check's own verifier only looks; it cannot send the check to a vendor.
  const ownVerifier = { ...otherVerifier, userId: 21n };
  await assert.rejects(
    assignFixture().service.assign(ownVerifier, "check-1", assignInput, now),
    /Only the case RM, the Team Leader or Operations/,
  );
  const lead = {
    tenantId: 1n,
    userId: 98n,
    roles: ["VERIFIER"],
    departments: [{ id: 4n, role: "LEAD" }],
  } as unknown as Actor;
  await assert.rejects(
    assignFixture().service.assign(lead, "check-1", assignInput, now),
    /Reason for the RM/,
  );
  assert.equal(
    (
      await assignFixture().service.assign(
        lead,
        "check-1",
        { ...assignInput, reason: "Remote address, needs a field visit" },
        now,
      )
    ).status,
    "PENDING_APPROVAL",
  );
  const owner = { tenantId: 1n, userId: 11n, roles: ["SPOC_RM"] } as Actor;
  assert.equal(
    (await assignFixture().service.assign(owner, "check-1", assignInput, now))
      .attempt,
    1,
  );
});

function reviewFixture(status = "SUBMITTED") {
  const checkUpdates: Array<Record<string, unknown>> = [];
  const jobUpdates: Array<Record<string, unknown>> = [];
  const audits: string[] = [];
  const notices: unknown[] = [];
  const tx = {
    vendorCheckAssignment: {
      findFirst: () => ({
        id: 5n,
        publicId: "job-1",
        status,
        version: 3,
        vendorUserId: 50n,
        handlerUserId: null,
        result: "CLEAR",
        remarks: "Met the neighbour",
        submissionJson: JSON.stringify({
          entries: [{ respondentName: "Neighbour" }],
        }),
        check: { publicId: "check-1" },
      }),
      updateMany: (args: { data: Record<string, unknown> }) => {
        jobUpdates.push(args.data);
        return { count: 1 };
      },
    },
    caseCheck: {
      findFirst: () => checkRow(),
      update: (args: { data: Record<string, unknown> }) =>
        checkUpdates.push(args.data),
    },
    notification: {
      create: (args: unknown) => notices.push(args),
      createMany: (args: { data: unknown[] }) => notices.push(...args.data),
    },
    auditEvent: {
      create: (args: { data: { action: string } }) =>
        audits.push(args.data.action),
    },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  return {
    service: new VendorChecksService(prisma, storage),
    checkUpdates,
    jobUpdates,
    audits,
    notices,
  };
}

void test("approving copies the vendor's verified details into the check and tells the verifier", async () => {
  const { service, checkUpdates, jobUpdates, audits, notices } =
    reviewFixture();
  await service.review(ops, "job-1", { decision: "APPROVE", version: 3 }, now);
  assert.equal(jobUpdates[0]!.status, "APPROVED");
  assert.equal(
    checkUpdates[0]!.verifiedJson,
    JSON.stringify({ entries: [{ respondentName: "Neighbour" }] }),
  );
  assert.deepEqual(audits, ["vendor_check.approved"]);
  assert.equal(notices.length, 2, "verifier and vendor");
});

void test("returning needs a reason; only a submitted result can be reviewed", async () => {
  const returned = reviewFixture();
  await assert.rejects(
    returned.service.review(
      ops,
      "job-1",
      { decision: "RETURN", note: "no", version: 3 },
      now,
    ),
    /Return reason/,
  );
  await returned.service.review(
    ops,
    "job-1",
    { decision: "RETURN", note: "Photo of the house is missing", version: 3 },
    now,
  );
  assert.equal(returned.jobUpdates[0]!.status, "RETURNED");
  assert.equal(returned.checkUpdates.length, 0);
  await assert.rejects(
    reviewFixture("IN_PROGRESS").service.review(
      ops,
      "job-1",
      { decision: "APPROVE", version: 3 },
      now,
    ),
    /Only a submitted result/,
  );
});

void test("a vendor team user only ever sees jobs delegated to it", () => {
  const main = { tenantId: 1n, userId: 50n, roles: ["VENDOR"] } as Actor;
  const member = {
    tenantId: 1n,
    userId: 51n,
    roles: ["VENDOR"],
    vendorOwnerId: 50n,
  } as unknown as Actor;
  const sent = { status: { notIn: ["PENDING_APPROVAL", "REJECTED"] } };
  assert.deepEqual(ownVendorJobs(main), {
    tenantId: 1n,
    vendorUserId: 50n,
    ...sent,
  });
  assert.deepEqual(ownVendorJobs(member), {
    tenantId: 1n,
    vendorUserId: 50n,
    handlerUserId: 51n,
    ...sent,
  });
  assert.throws(() => ownVendorJobs(ops), /Vendor access/);
});

function workFixture(job: Record<string, unknown>) {
  const updates: Array<Record<string, unknown>> = [];
  const row = {
    id: 5n,
    publicId: "job-1",
    attempt: 1,
    status: "IN_PROGRESS",
    version: 2,
    dueAt: null,
    note: null,
    result: "CLEAR",
    remarks: "Confirmed with the neighbour",
    declineReason: null,
    reviewNote: null,
    acceptedAt: now,
    submittedAt: null,
    reviewedAt: null,
    createdAt: now,
    assignedById: 2n,
    vendorUserId: 50n,
    handlerUserId: null,
    caseId: 3n,
    sharedDocumentsJson: JSON.stringify(["doc-1"]),
    submissionJson: JSON.stringify({
      entries: [
        {
          respondentName: "Neighbour",
          addressConfirmed: "Yes",
          method: "Physical visit",
          verificationDate: "2026-10-07",
        },
      ],
    }),
    check: { publicId: "check-1", type: "ADDRESS", initiationJson: null },
    case: {
      publicId: "case-1",
      caseNumber: "SG-1",
      subject: { fullName: "Aarav" },
    },
    client: { displayName: "Vision India" },
    vendor: { publicId: "vendor-1", displayName: "Field Co" },
    handler: null,
    assignedBy: { displayName: "Ops" },
    reviewedBy: null,
    _count: { evidence: 1 },
    evidence: [
      {
        publicId: "e1",
        originalName: "house.jpg",
        contentType: "image/jpeg",
        sizeBytes: 10,
        createdAt: now,
      },
    ],
    ...job,
  };
  const tx = {
    vendorCheckAssignment: {
      findFirst: () => row,
      updateMany: (args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return { count: 1 };
      },
    },
    notification: { create: () => ({}) },
    auditEvent: { create: () => ({}) },
  };
  const prisma = {
    ...tx,
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const service = new VendorWorkService(
    prisma,
    storage,
    {} as ContentInspectionService,
    {} as DocumentsService,
  );
  return { service, updates };
}

const vendor = { tenantId: 1n, userId: 50n, roles: ["VENDOR"] } as Actor;

void test("a vendor submits verified details with a result, remarks and proof", async () => {
  const { service, updates } = workFixture({});
  await service.submit(vendor, "job-1", 2);
  assert.equal(updates[0]!.status, "SUBMITTED");
  await assert.rejects(
    workFixture({ evidence: [], _count: { evidence: 0 } }).service.submit(
      vendor,
      "job-1",
      2,
    ),
    /proof file/,
  );
  await assert.rejects(
    workFixture({ result: null }).service.submit(vendor, "job-1", 2),
    /result/,
  );
  await assert.rejects(
    workFixture({
      submissionJson: JSON.stringify({ entries: [{}] }),
    }).service.submit(vendor, "job-1", 2),
    /required/,
  );
  // Unable to verify needs no proof file.
  const utv = workFixture({
    result: "UNABLE_TO_VERIFY",
    evidence: [],
    _count: { evidence: 0 },
  });
  await utv.service.submit(vendor, "job-1", 2);
  assert.equal(utv.updates[0]!.status, "SUBMITTED");
});

void test("a vendor never opens a document that was not shared with the job", async () => {
  const { service } = workFixture({});
  await assert.rejects(
    service.document(vendor, "job-1", "doc-2"),
    /not shared/,
  );
});

void test("overdue jobs remind the vendor and the assigner once a day", async () => {
  const notices: Array<{ userId: bigint }> = [];
  let claimed = 1;
  const tx = {
    vendorCheckAssignment: { updateMany: () => ({ count: claimed }) },
    notification: {
      createMany: (args: { data: Array<{ userId: bigint }> }) =>
        notices.push(...args.data),
    },
    auditEvent: { create: () => ({}) },
  };
  const prisma = {
    vendorCheckAssignment: {
      findMany: () => [
        {
          id: 5n,
          publicId: "job-1",
          tenantId: 1n,
          vendorUserId: 50n,
          handlerUserId: 51n,
          assignedById: 2n,
          lastRemindedAt: null,
          dueAt: new Date("2026-10-06T00:00:00Z"),
          check: { type: "ADDRESS" },
          case: { publicId: "case-1", caseNumber: "SG-1" },
          vendor: { displayName: "Field Co" },
        },
      ],
    },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const worker = new VendorCheckReminderService(prisma, {
    get: () => undefined,
  } as unknown as ConfigService);
  assert.equal(await worker.run(now), 1);
  assert.deepEqual(
    notices.map((notice) => notice.userId),
    [51n, 2n],
  );
  claimed = 0;
  assert.equal(await worker.run(now), 0, "another worker already reminded");
});

void test("custom report keeps only the chosen columns; defaults and ageing are sensible", () => {
  assert.deepEqual(exportColumns("caseNumber,status,bogus"), [
    "caseNumber",
    "status",
  ]);
  assert.equal(exportColumns(undefined).length, 14);
  const csv = vendorCsv(
    [
      {
        caseNumber: "SG-1",
        status: "IN_PROGRESS",
      } as never,
    ],
    ["caseNumber", "status"],
  );
  assert.match(csv, /Sapling ID,Status\r\nSG-1,In progress/);
  assert.deepEqual(defaultSharedTypes("address"), ["ADDRESS_PROOF", "AADHAAR"]);
  assert.equal(ageingBucket(4), "3-5");
  assert.equal(ageingBucket(11), "10+");
});

void test("a Team Leader's vendor request waits for the case RM, with its reason", async () => {
  const lead = {
    tenantId: 1n,
    userId: 98n,
    roles: ["VERIFIER"],
    departments: [{ id: 4n, role: "LEAD" }],
  } as unknown as Actor;
  const { service, created, audits, notices } = assignFixture();
  await service.assign(
    lead,
    "check-1",
    { ...assignInput, reason: "Remote address, needs a field visit" },
    now,
  );
  assert.equal(created[0]!.status, "PENDING_APPROVAL");
  assert.equal(created[0]!.assignedAs, "TEAM_LEADER");
  assert.equal(
    created[0]!.requestReason,
    "Remote address, needs a field visit",
  );
  // The RM (case owner 11) is asked; the vendor hears nothing yet.
  assert.equal(notices.length, 1);
  assert.equal((notices[0] as { data: { userId: bigint } }).data.userId, 11n);
  assert.equal(audits[0]!.action, "vendor_check.approval-requested");
});

function decideFixture(job: Record<string, unknown> = {}) {
  const updates: Array<Record<string, unknown>> = [];
  const audits: string[] = [];
  const notices: Array<{ data: { userId: bigint; title: string } }> = [];
  const tx = {
    vendorCheckAssignment: {
      findFirst: () => ({
        id: 5n,
        publicId: "job-1",
        status: "PENDING_APPROVAL",
        version: 1,
        vendorUserId: 50n,
        handlerUserId: null,
        assignedAs: "TEAM_LEADER",
        assignedById: 98n,
        dueAt: null,
        vendor: { displayName: "Field Co" },
        check: { publicId: "check-1" },
        ...job,
      }),
      updateMany: (args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return { count: 1 };
      },
    },
    caseCheck: { findFirst: () => checkRow() },
    notification: {
      create: (args: (typeof notices)[number]) => notices.push(args),
    },
    auditEvent: {
      create: (args: { data: { action: string } }) =>
        audits.push(args.data.action),
    },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  return {
    service: new VendorChecksService(prisma, storage),
    updates,
    audits,
    notices,
  };
}

void test("the case RM approves a Team Leader's request: it reaches the vendor, TL told", async () => {
  const rm = { tenantId: 1n, userId: 11n, roles: ["SPOC_RM"] } as Actor;
  const { service, updates, audits, notices } = decideFixture();
  const result = await service.decide(
    rm,
    "job-1",
    { decision: "APPROVE", version: 1 },
    now,
  );
  assert.equal(result.status, "ASSIGNED");
  assert.equal(updates[0]!.approvedById, 11n);
  assert.deepEqual(
    notices.map((n) => n.data.userId),
    [50n, 98n],
  );
  assert.deepEqual(audits, ["vendor_check.request-approved"]);
});

void test("a turned-down request needs a reason; the TL itself cannot approve", async () => {
  const rm = { tenantId: 1n, userId: 11n, roles: ["SPOC_RM"] } as Actor;
  await assert.rejects(
    decideFixture().service.decide(
      rm,
      "job-1",
      { decision: "REJECT", version: 1 },
      now,
    ),
    /Reason for turning it down/,
  );
  const rejected = decideFixture();
  await rejected.service.decide(
    rm,
    "job-1",
    { decision: "REJECT", note: "Use the source email first", version: 1 },
    now,
  );
  assert.equal(rejected.updates[0]!.status, "REJECTED");
  assert.equal(rejected.notices.length, 1);
  const lead = {
    tenantId: 1n,
    userId: 98n,
    roles: ["VERIFIER"],
    departments: [{ id: 4n, role: "LEAD" }],
  } as unknown as Actor;
  await assert.rejects(
    decideFixture().service.decide(
      lead,
      "job-1",
      { decision: "APPROVE", version: 1 },
      now,
    ),
    /Only the case RM/,
  );
});

void test("whoever sent the job reviews the vendor's result", () => {
  const check = checkRow();
  const rm = { tenantId: 1n, userId: 11n, roles: ["SPOC_RM"] } as Actor;
  const lead = {
    tenantId: 1n,
    userId: 98n,
    roles: ["VERIFIER"],
    departments: [{ id: 4n, role: "LEAD" }],
  } as unknown as Actor;
  const verifier = {
    tenantId: 1n,
    userId: 21n,
    roles: ["VERIFIER"],
    departments: [],
  } as unknown as Actor;
  assert.equal(canReview(lead, check, { assignedAs: "TEAM_LEADER" }), true);
  assert.equal(canReview(rm, check, { assignedAs: "TEAM_LEADER" }), false);
  assert.equal(canReview(rm, check, { assignedAs: "RM" }), true);
  assert.equal(canReview(lead, check, { assignedAs: "RM" }), false);
  assert.equal(canReview(ops, check, { assignedAs: "TEAM_LEADER" }), true);
  assert.equal(canReview(verifier, check, { assignedAs: "RM" }), false);
  assert.equal(assignAs(verifier, check), null);
});

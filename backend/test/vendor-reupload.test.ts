import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { SpocVendorsController } from "../src/vendor-requests/spoc-vendors.controller";
import { passesGuard } from "./helpers/guard-check";
import {
  documentRow,
  input,
  rejectedAttempt,
  reuploadHarness,
  secrets,
  spocAB,
} from "./helpers/reupload-fixtures";
import { testActor } from "./helpers/test-actor";
import { DOC } from "./helpers/vendor-fixtures";

void test("Re-upload moves the document into the existing REUPLOAD_REQUIRED state and never edits the rejection", async () => {
  const { service, calls } = reuploadHarness(documentRow());
  const result = await service.request(spocAB, DOC, input);

  assert.equal(result.status, "REUPLOAD_REQUIRED");
  assert.equal(result.version, 5);
  assert.equal(result.candidateMessage, "EMAIL");
  assert.equal(result.candidateLink?.active, true);

  const find = calls.find![0]!;
  assert.deepEqual(find.where!.case, {
    tenantId: 7n,
    clientId: { in: [21n, 22n] },
  });
  const update = calls.update![0]!;
  assert.deepEqual(update.where, { id: 91n, version: 4 });
  assert.equal(update.data!.status, "REUPLOAD_REQUIRED");
  assert.equal(update.data!.reviewNote, input.message);
  assert.equal(update.data!.reviewedById, 11n);
  assert.deepEqual(update.data!.version, { increment: 1 });
  assert.equal(calls.lock?.length, 1, "case evidence is locked");
  // The rejected attempt (reason, attempt number) is never written.
  assert.equal(calls.vendorWrite, undefined);

  const audit = calls.audit![0]!.data!;
  assert.equal(audit.action, "document.reupload-requested");
  assert.equal(audit.resourceType, "document");
  const after = JSON.parse(String(audit.afterJson)) as Record<string, unknown>;
  assert.equal(after.rejectedAssignmentId, "a1");
  assert.equal(after.attempt, 1);
  assert.equal(after.message, input.message);

  const ops = calls.notify![0]!.data as unknown as Array<
    Record<string, unknown>
  >;
  assert.equal(ops[0]!.type, "DOCUMENT_REUPLOAD_REQUESTED");
  assert.equal(ops[0]!.href, "/cases/case-1");

  // A fresh link replaces any earlier (possibly completed) one and is emailed with
  // the reason; consent is not asked again.
  assert.equal(calls.revokeLinks?.length, 1);
  assert.equal(calls.newLink?.length, 1);
  const outbox = calls.outbox![0]!.data!;
  assert.equal(outbox.topic, "candidate.access.issued");
  const payload = JSON.parse(String(outbox.payloadJson)) as { secret: string };
  const delivery = secrets.open<{
    channel: string;
    destination: string;
    portalUrl: string;
    reason: string;
  }>(payload.secret);
  assert.equal(delivery.channel, "EMAIL");
  assert.equal(delivery.destination, "vivo@example.com");
  assert.match(delivery.portalUrl, /\/candidate\/access-2#token=/);
  assert.equal(delivery.reason, `Education certificate: ${input.message}`);
});

void test("Re-upload is refused unless the latest attempt is a rejection of an open, uploadable case", async () => {
  const refuse = async (
    row: unknown,
    expected: RegExp | typeof NotFoundException,
  ) => {
    const { service, calls } = reuploadHarness(row);
    await assert.rejects(service.request(spocAB, DOC, input), expected);
    assert.equal(calls.update, undefined);
  };
  await refuse(null, NotFoundException);
  for (const status of ["PENDING", "APPROVED"])
    await refuse(
      documentRow({ vendorAssignments: [{ ...rejectedAttempt, status }] }),
      /only after a vendor rejection/,
    );
  await refuse(
    documentRow({ vendorAssignments: [] }),
    /only after a vendor rejection/,
  );
  await refuse(
    documentRow({
      vendorAssignments: [
        rejectedAttempt,
        { publicId: "a2", attempt: 2, status: "PENDING" },
      ],
    }),
    /only after a vendor rejection/,
  );
  await refuse(
    documentRow({ status: "REUPLOAD_REQUIRED" }),
    /already been requested/,
  );
  for (const status of [
    "QA_REVIEW",
    "MANAGER_REVIEW",
    "COMPLETED",
    "CANCELLED",
  ])
    await refuse(
      documentRow({ case: { ...documentRow().case, status } }),
      /QA review or later/,
    );
  await refuse(documentRow({ version: 3 }), /refresh/);

  const raced = reuploadHarness(documentRow(), { updated: 0 });
  await assert.rejects(
    raced.service.request(spocAB, DOC, input),
    ConflictException,
  );
  const blank = reuploadHarness(documentRow());
  await assert.rejects(
    blank.service.request(spocAB, DOC, { ...input, message: "   " }),
    BadRequestException,
  );
});

void test("no candidate email or SMS is queued when the candidate has no contact details", async () => {
  const row = documentRow();
  const { service, calls } = reuploadHarness({
    ...row,
    case: { ...row.case, subject: { ...row.case.subject, email: null } },
  });
  const result = await service.request(spocAB, DOC, input);
  assert.equal(result.candidateMessage, null);
  assert.equal(calls.outbox, undefined);
});

void test("only SPOC-RM and Platform Admin with vendor:assign reach the re-upload route", () => {
  const allowed = (who: typeof spocAB) =>
    passesGuard(SpocVendorsController, "requestReupload", who);
  assert.ok(allowed(spocAB));
  assert.ok(
    passesGuard(
      SpocVendorsController,
      "requestReupload",
      testActor(["PLATFORM_ADMIN"], ["*"]),
      { platformAdminViewOnly: false },
    ),
  );
  // Default: the Platform Admin is view-only.
  assert.ok(!allowed(testActor(["PLATFORM_ADMIN"], ["*"])));
  assert.ok(!allowed({ ...spocAB, permissions: ["dashboard:read"] }));
  for (const role of ["VENDOR", "CLIENT_ADMIN", "OPS_MANAGER", "SUPPORT_AGENT"])
    assert.ok(!allowed(testActor([role], ["*"])), role);
});

import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../src/database/prisma.service";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import { SubjectPiiService } from "../src/common/security/subject-pii.service";
import { renderEmail } from "../src/common/mail/email-templates";
import {
  cleanInitiation,
  needsInitiation,
} from "../src/workflow/initiation-fields";
import { applyIntakeRules } from "../src/workflow/intake-rules";
import { sendInsufficiencyNotice } from "../src/clarifications/insufficiency-notice";
import {
  InsufficiencyReminderService,
  REMINDER_EVERY_MS,
} from "../src/clarifications/insufficiency-reminder.service";

const config = new ConfigService({
  WEB_ORIGIN: "https://verify.saplingglobal.in",
  JWT_REFRESH_SECRET: "test-refresh-secret-with-sufficient-entropy",
});
const secretBox = new SecretBoxService(config);
const pii = new SubjectPiiService(secretBox);
const deps = { secretBox, pii, webOrigin: "https://verify.saplingglobal.in" };

/** A transaction double that records every write. */
function txDouble(overrides: Record<string, Record<string, unknown>> = {}) {
  const writes: Array<{ kind: string; data: unknown }> = [];
  const record =
    (kind: string, result: unknown = {}) =>
    (data: unknown) => {
      writes.push({ kind, data });
      return Promise.resolve(result);
    };
  const tx = {
    verificationCase: {
      update: record("case.update"),
      updateMany: record("case.updateMany", { count: 1 }),
    },
    auditEvent: { create: record("audit") },
    notification: { createMany: record("notify"), create: record("notify1") },
    outboxEvent: { create: record("outbox") },
    candidatePortalAccess: {
      updateMany: record("revoke", { count: 1 }),
      create: record("link", { publicId: "access-9" }),
    },
    user: {
      findMany: () => Promise.resolve([{ id: 70n, email: "hr@acme.example" }]),
    },
    ...overrides,
  };
  return { tx: tx as never, writes };
}

const ruleCase = (
  extra: Record<string, unknown> = {},
  client: Record<string, unknown> = {},
) => ({
  id: 30n,
  publicId: "case-30",
  caseNumber: "SG-30",
  tenantId: 7n,
  status: "DOCUMENT_PENDING",
  version: 4,
  workflowVersion: 2,
  intakeStage: "INTAKE",
  assignedOpsUserId: 10n,
  dataEntryUserId: null,
  subject: { fullName: "Aarav Shah" },
  client: {
    id: 21n,
    displayName: "Acme",
    clientReviewFirst: false,
    defaultDataEntryUser: null,
    ...client,
  },
  ...extra,
});

void test("check-wise initiation requires the document's * fields and validates formats", () => {
  assert.ok(needsInitiation("employment"));
  assert.ok(
    needsInitiation("DRUG_TEST"),
    "panel and collection are recorded at intake",
  );
  assert.ok(!needsInitiation("GLOBAL_DATABASE"));
  const [entry] = cleanInitiation("ADDRESS", [
    {
      addressType: "Current",
      address: " 12 MG Road ",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      contactNumber: "9876543210",
      extra: "dropped",
    },
  ]);
  assert.equal(entry!.address, "12 MG Road");
  assert.equal("extra" in entry!, false);
  assert.throws(
    () =>
      cleanInitiation("ADDRESS", [
        {
          addressType: "Current",
          address: "x",
          city: "a",
          state: "b",
          pincode: "123",
          contactNumber: "9876543210",
        },
      ]),
    /Pin code is not valid/,
  );
  assert.throws(
    () => cleanInitiation("EMPLOYMENT", [{ employerName: "Acme" }]),
    BadRequestException,
  );
  assert.throws(
    () =>
      cleanInitiation("COURT_RECORD", [
        { addressBasis: "Current", years: "5" },
      ]),
    /choose one of the options/,
  );
  assert.throws(
    () =>
      cleanInitiation("EMPLOYMENT", [
        {
          employerName: "A",
          tenureFrom: "2024-05-01",
          tenureTo: "2023-01-01",
          empCode: "E1",
        },
      ]),
    /Tenure to must be after/,
  );
  // Previous employers: more than one entry ("option Add").
  assert.equal(
    cleanInitiation("EMPLOYMENT", [
      {
        employerName: "A",
        tenureFrom: "2020-01-01",
        tenureTo: "2022-01-01",
        empCode: "E1",
      },
      {
        employerName: "B",
        tenureFrom: "2022-02-01",
        tenureTo: "2024-01-01",
        empCode: "E2",
      },
    ]).length,
    2,
  );
});

void test("Route A: a client that reviews first gets the submission before Sapling", async () => {
  const { tx, writes } = txDouble({
    verificationCase: {
      findUniqueOrThrow: () =>
        Promise.resolve(ruleCase({}, { clientReviewFirst: true })),
      update: (data: unknown) => {
        writes.push({ kind: "case.update", data });
        return Promise.resolve({});
      },
    },
  });
  assert.equal(await applyIntakeRules(tx, 30n), "client-review");
  const update = writes.find((w) => w.kind === "case.update")!.data as {
    data: { intakeStage: string };
  };
  assert.equal(update.data.intakeStage, "CLIENT_REVIEW");
  const notice = writes.find((w) => w.kind === "notify")!.data as {
    data: Array<{ href: string }>;
  };
  assert.equal(notice.data[0]!.href, "/client-portal/review");
  const audit = writes.find((w) => w.kind === "audit")!.data as {
    data: { action: string };
  };
  assert.equal(audit.data.action, "case.client-review-requested");
});

void test("auto-assignment rule: the client's Data Entry user gets the case, audited", async () => {
  const dataEntry = {
    id: 60n,
    publicId: "de-1",
    displayName: "Priya DE",
    status: "ACTIVE",
    userRoles: [{ role: { code: "DATA_ENTRY" } }],
  };
  const { tx, writes } = txDouble({
    verificationCase: {
      findUniqueOrThrow: () =>
        Promise.resolve(ruleCase({}, { defaultDataEntryUser: dataEntry })),
      updateMany: (data: unknown) => {
        writes.push({ kind: "case.updateMany", data });
        return Promise.resolve({ count: 1 });
      },
    },
  });
  assert.equal(await applyIntakeRules(tx, 30n), "auto-data-entry");
  const update = writes.find((w) => w.kind === "case.updateMany")!.data as {
    data: { dataEntryUserId: bigint; intakeStage: string };
  };
  assert.equal(update.data.dataEntryUserId, 60n);
  assert.equal(update.data.intakeStage, "DATA_ENTRY");
  const audit = writes.find((w) => w.kind === "audit")!.data as {
    data: { afterJson: string };
  };
  assert.equal(JSON.parse(audit.data.afterJson).auto, true);

  // No rule, an inactive user, or a case already with Data Entry: nothing happens.
  for (const item of [
    ruleCase(),
    ruleCase(
      {},
      { defaultDataEntryUser: { ...dataEntry, status: "SUSPENDED" } },
    ),
    ruleCase(
      { intakeStage: "DATA_ENTRY", dataEntryUserId: 61n },
      { defaultDataEntryUser: dataEntry },
    ),
  ]) {
    const quiet = txDouble({
      verificationCase: { findUniqueOrThrow: () => Promise.resolve(item) },
    });
    assert.equal(await applyIntakeRules(quiet.tx, 30n), "none");
    assert.equal(quiet.writes.length, 0);
  }
});

void test("L1 insufficiency: candidate gets a fresh link with the reason, company admin is told", async () => {
  const { tx, writes } = txDouble({
    verificationCase: {
      findUniqueOrThrow: () =>
        Promise.resolve({
          publicId: "case-30",
          caseNumber: "SG-30",
          clientId: 21n,
          subject: {
            fullName: "Aarav Shah",
            email: "aarav@example.com",
            phone: null,
            employeeCode: null,
            piiCiphertext: null,
            piiKeyVersion: 1,
          },
        }),
    },
  });
  const result = await sendInsufficiencyNotice(tx, deps, {
    tenantId: 7n,
    caseId: 30n,
    subject: "Employment proof missing",
    message: "Please upload your relieving letter.",
  });
  assert.deepEqual(result, { candidateReached: true, clientAdmins: 1 });
  const outbox = writes
    .filter((w) => w.kind === "outbox")
    .map(
      (w) => (w.data as { data: { topic: string; payloadJson: string } }).data,
    );
  const candidate = outbox.find(
    (row) => row.topic === "candidate.access.issued",
  )!;
  const link = secretBox.open<{ reason: string; destination: string }>(
    (JSON.parse(candidate.payloadJson) as { secret: string }).secret,
  );
  assert.equal(link.destination, "aarav@example.com");
  assert.match(link.reason, /^Information needed: Employment proof missing/);
  const email = outbox.find((row) => row.topic === "email.requested")!;
  const mail = secretBox.open<{
    to: string;
    template: string;
    variables: Record<string, unknown>;
  }>((JSON.parse(email.payloadJson) as { secret: string }).secret);
  assert.equal(mail.to, "hr@acme.example");
  assert.equal(mail.template, "insufficiency");
  assert.match(
    renderEmail("insufficiency", mail.variables).subject,
    /Information needed for SG-30/,
  );
});

void test("24-hour re-alert: only L1s open a full day since the last notice, at most 7 times", async () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const sent: number[] = [];
  const service = (previous: Date[]) => {
    const tx = {
      auditEvent: {
        findMany: () =>
          Promise.resolve(previous.map((createdAt) => ({ createdAt }))),
        create: (input: { data: { action: string; afterJson: string } }) => {
          if (input.data.action === "clarification.insufficiency-reminder")
            sent.push(JSON.parse(input.data.afterJson).reminder as number);
          return Promise.resolve({});
        },
      },
      verificationCase: {
        findUniqueOrThrow: () =>
          Promise.resolve({
            publicId: "case-30",
            caseNumber: "SG-30",
            clientId: 21n,
            subject: {
              fullName: "Aarav Shah",
              email: "aarav@example.com",
              phone: null,
              employeeCode: null,
              piiCiphertext: null,
              piiKeyVersion: 1,
            },
          }),
      },
      candidatePortalAccess: {
        updateMany: () => Promise.resolve({ count: 1 }),
        create: () => Promise.resolve({ publicId: "access-2" }),
      },
      outboxEvent: { create: () => Promise.resolve({}) },
      notification: { createMany: () => Promise.resolve({}) },
      user: { findMany: () => Promise.resolve([]) },
    };
    const prisma = {
      clarification: {
        findMany: () =>
          Promise.resolve([
            {
              id: 1n,
              publicId: "clar-1",
              tenantId: 7n,
              caseId: 30n,
              subject: "Employment proof missing",
              createdAt: new Date(now.getTime() - 3 * REMINDER_EVERY_MS),
              messages: [{ body: "Upload relieving letter" }],
            },
          ]),
      },
      $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    } as unknown as PrismaService;
    return new InsufficiencyReminderService(prisma, config, secretBox, pii);
  };
  // Last reminder 25 hours ago: due, and it is the 2nd one.
  assert.equal(
    await service([new Date(now.getTime() - 25 * 3_600_000)]).run(now),
    1,
  );
  // Last reminder 5 hours ago: not yet.
  assert.equal(
    await service([new Date(now.getTime() - 5 * 3_600_000)]).run(now),
    0,
  );
  // Seven reminders already: stop.
  assert.equal(
    await service(
      Array.from({ length: 7 }, () => new Date(now.getTime() - 48 * 3_600_000)),
    ).run(now),
    0,
  );
  assert.deepEqual(sent, [2]);
});

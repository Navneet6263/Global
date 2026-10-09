import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import { renderEmail } from "../src/common/mail/email-templates";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { PrismaService } from "../src/database/prisma.service";
import { SourceEmailFollowUpService } from "../src/verification/source-email-follow-up.service";
import {
  FOLLOW_UP_EVERY_MS,
  SourceEmailService,
} from "../src/verification/source-email.service";
import type { VerificationMethodsService } from "../src/verification/verification-methods.service";

const actor = {
  tenantId: 1n,
  userId: 9n,
  roles: ["VERIFIER"],
} as Actor;
const now = new Date("2026-10-07T06:00:00Z");

function sealer() {
  const sealed: Array<Record<string, unknown>> = [];
  return {
    sealed,
    box: {
      seal: (value: Record<string, unknown>) => (sealed.push(value), "sealed"),
    } as unknown as SecretBoxService,
  };
}

function sendFixture(type = "EMPLOYMENT") {
  const created: Array<Record<string, unknown>> = [];
  const audits: Array<{ action: string; afterJson: string }> = [];
  const tx = {
    sourceEmail: {
      create: (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return {
          publicId: "email-1",
          nextFollowUpAt: args.data.nextFollowUpAt,
        };
      },
    },
    outboxEvent: { create: () => ({}) },
    auditEvent: {
      create: (args: { data: { action: string; afterJson: string } }) =>
        audits.push(args.data),
    },
  };
  const prisma = {
    document: {
      findMany: () => [
        {
          versions: [
            {
              objectKey: "cases/1/relieving.pdf",
              originalName: "relieving.pdf",
              contentType: "application/pdf",
              sizeBytes: 2048n,
            },
          ],
        },
      ],
    },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const methods = {
    check: () => ({
      id: 3n,
      type,
      status: "IN_PROGRESS",
      case: { id: 2n, publicId: "case-1", caseNumber: "SG-1" },
    }),
  } as unknown as VerificationMethodsService;
  const { sealed, box } = sealer();
  return {
    service: new SourceEmailService(prisma, methods, box),
    created,
    audits,
    sealed,
  };
}

const input = {
  to: "HR@Acme.test",
  cc: ["ops@sapling.test"],
  subject: "Employment verification for SG-1",
  body: "Please confirm the employment details of the candidate below.",
  documentIds: ["7c9e6679-7425-40de-944b-e07fc1f90ae7"],
};

void test("employment email schedules 7 follow-ups and sends the case document", async () => {
  const { service, created, audits, sealed } = sendFixture();
  const result = await service.send(actor, "check-1", input, now);
  assert.equal(result.maxFollowUps, 7);
  assert.equal(created[0]!.toEmail, "hr@acme.test");
  assert.equal(created[0]!.ccEmails, "ops@sapling.test");
  assert.deepEqual(
    created[0]!.nextFollowUpAt,
    new Date(now.getTime() + FOLLOW_UP_EVERY_MS),
  );
  const mail = sealed[0]!;
  assert.equal(mail.template, "source-verification");
  assert.deepEqual(mail.cc, ["ops@sapling.test"]);
  assert.deepEqual(mail.attachments, [
    {
      objectKey: "cases/1/relieving.pdf",
      filename: "relieving.pdf",
      contentType: "application/pdf",
    },
  ]);
  assert.equal(audits[0]!.action, "verification.source-email-sent");
  const after = JSON.parse(audits[0]!.afterJson) as Record<string, unknown>;
  assert.equal(after.toDomain, "acme.test");
  assert.equal(after.attachments, 1);
  assert.equal(JSON.stringify(after).includes("Please confirm"), false);
});

void test("education gets 3 follow-ups, other checks none, and opting out means none", async () => {
  assert.equal(
    (await sendFixture("EDUCATION").service.send(actor, "c", input, now))
      .maxFollowUps,
    3,
  );
  const other = sendFixture("COURT_RECORD");
  assert.equal(
    (await other.service.send(actor, "c", input, now)).maxFollowUps,
    0,
  );
  assert.equal(other.created[0]!.nextFollowUpAt, null);
  assert.equal(
    (
      await sendFixture().service.send(
        actor,
        "c",
        { ...input, autoFollowUp: false },
        now,
      )
    ).maxFollowUps,
    0,
  );
});

void test("bad addresses are refused", async () => {
  const { service } = sendFixture();
  await assert.rejects(
    service.send(actor, "c", { ...input, cc: ["not-an-email"] }, now),
    /valid email/,
  );
});

void test("source email renders the verifier's own subject and body", () => {
  const email = renderEmail("source-verification", {
    subject: "Verify <Aarav>",
    body: "Line one\nLine two\n\nNext paragraph",
  });
  assert.equal(email.subject, "Verify <Aarav>");
  assert.match(email.html, /Line one<br>Line two/);
  assert.match(email.html, /Verify &lt;Aarav&gt;/);
});

function followUpFixture(
  row: Partial<{
    followUpsSent: number;
    maxFollowUps: number;
    respondedAt: Date | null;
    verifiedAt: Date | null;
    status: string;
  }> = {},
) {
  const updates: Array<Record<string, unknown>> = [];
  const audits: string[] = [];
  const email = {
    id: 1n,
    publicId: "email-1",
    tenantId: 1n,
    toEmail: "hr@acme.test",
    ccEmails: null,
    subject: "Employment verification",
    body: "Please confirm.",
    attachmentsJson: "[]",
    maxFollowUps: row.maxFollowUps ?? 7,
    followUpsSent: row.followUpsSent ?? 0,
    createdAt: new Date(now.getTime() - 2 * FOLLOW_UP_EVERY_MS),
    check: {
      publicId: "check-1",
      status: row.status ?? "IN_PROGRESS",
      verifiedAt: row.verifiedAt ?? null,
      case: { publicId: "case-1", status: "IN_PROGRESS" },
      methodRuns: row.respondedAt ? [{ respondedAt: row.respondedAt }] : [],
    },
  };
  const tx = {
    sourceEmail: {
      updateMany: (args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return { count: 1 };
      },
    },
    outboxEvent: { create: () => ({}) },
    auditEvent: {
      create: (args: { data: { action: string } }) =>
        audits.push(args.data.action),
    },
  };
  const prisma = {
    sourceEmail: { findMany: () => [email] },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const { sealed, box } = sealer();
  return {
    worker: new SourceEmailFollowUpService(
      prisma,
      { get: () => undefined } as unknown as ConfigService,
      box,
    ),
    updates,
    audits,
    sealed,
  };
}

void test("a due follow-up is sent as a numbered reminder and the next one scheduled", async () => {
  const { worker, updates, audits, sealed } = followUpFixture({
    followUpsSent: 2,
  });
  assert.equal(await worker.run(now), 1);
  assert.equal(updates[0]!.followUpsSent, 3);
  assert.deepEqual(
    updates[0]!.nextFollowUpAt,
    new Date(now.getTime() + FOLLOW_UP_EVERY_MS),
  );
  const variables = sealed[0]!.variables as Record<string, string>;
  assert.equal(variables.subject, "Reminder 3: Employment verification");
  assert.match(variables.body, /\(3 of 7\)/);
  assert.deepEqual(audits, ["verification.source-email-follow-up"]);
});

void test("the last follow-up closes the schedule", async () => {
  const { worker, updates } = followUpFixture({
    followUpsSent: 2,
    maxFollowUps: 3,
  });
  await worker.run(now);
  assert.equal(updates[0]!.nextFollowUpAt, null);
  assert.equal(updates[0]!.stopReason, "All follow-ups sent");
});

void test("follow-ups stop once the source responds or details are verified", async () => {
  for (const [fields, reason] of [
    [{ respondedAt: now }, "Source responded"],
    [{ verifiedAt: now }, "Verified details recorded"],
    [{ status: "COMPLETED" }, "Check closed"],
  ] as const) {
    const { worker, updates, audits, sealed } = followUpFixture(fields);
    assert.equal(await worker.run(now), 0);
    assert.equal(updates[0]!.stopReason, reason);
    assert.equal(sealed.length, 0);
    assert.deepEqual(audits, ["verification.source-email-stopped"]);
  }
});

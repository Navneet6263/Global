import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../src/database/prisma.service";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import { SubjectPiiService } from "../src/common/security/subject-pii.service";
import { ConsentIssuanceService } from "../src/consents/consent-issuance.service";
import type { ConsentsService } from "../src/consents/consents.service";
import { digestPortalToken } from "../src/candidate-portal/candidate-access-authorizer";
import { CandidateConsentService } from "../src/candidate-portal/candidate-consent.service";
import { CandidatePortalService } from "../src/candidate-portal/candidate-portal.service";
import type { DocumentsService } from "../src/documents/documents.service";
import type { RequesterSupportRequestsService } from "../src/support/services/requester-support-requests.service";
import { renderEmail } from "../src/common/mail/email-templates";

const token = "candidate-token";
const config = new ConfigService({
  WEB_ORIGIN: "https://verify.saplingglobal.in",
  JWT_REFRESH_SECRET: "test-refresh-secret-with-sufficient-entropy",
});
const secrets = new SecretBoxService(config);
const pii = new SubjectPiiService(secrets);

function harness(consentStatus = "REQUESTED") {
  const outbox: Array<{ topic: string; payloadJson: string }> = [];
  const confirmed: string[] = [];
  const access = {
    id: 1n,
    publicId: "access-1",
    tenantId: 7n,
    caseId: 81n,
    tokenHash: digestPortalToken(token),
    revokedAt: null,
    completedAt: null,
    expiresAt: new Date(Date.now() + 86_400_000),
    case: {
      publicId: "case-1",
      subjectId: 5n,
      consents: [{ status: consentStatus }],
    },
  };
  const tx = {
    consent: { updateMany: () => Promise.resolve({ count: 1 }) },
    consentEvent: { create: () => Promise.resolve({}) },
    outboxEvent: {
      updateMany: () => Promise.resolve({ count: 0 }),
      create: ({ data }: { data: { topic: string; payloadJson: string } }) => {
        outbox.push(data);
        return Promise.resolve({});
      },
    },
    auditEvent: { create: () => Promise.resolve({}) },
  };
  const prisma = {
    candidatePortalAccess: { findUnique: () => Promise.resolve(access) },
    consent: {
      findFirst: () =>
        Promise.resolve({
          id: 3n,
          publicId: "consent-1",
          status: consentStatus,
        }),
    },
    subject: {
      findUniqueOrThrow: () =>
        Promise.resolve({
          email: "vivo@example.com",
          phone: "9876543210",
          employeeCode: null,
          piiCiphertext: null,
          piiKeyVersion: 1,
        }),
    },
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaService;
  const consents = {
    confirm: (publicId: string) => {
      confirmed.push(publicId);
      return Promise.resolve({ accepted: true, acceptedAt: new Date() });
    },
  } as unknown as ConsentsService;
  const service = new CandidateConsentService(
    prisma,
    pii,
    new ConsentIssuanceService(config, secrets),
    consents,
  );
  return { service, outbox, confirmed, prisma };
}

void test("the consent code is emailed from inside the candidate link, with no separate consent link", async () => {
  const { service, outbox } = harness();
  const result = await service.sendOtp("access-1", token);
  assert.equal(result.sent, true);
  assert.equal(result.destination, "vi***@example.com");
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0]!.topic, "consent.otp.requested");
  const payload = JSON.parse(outbox[0]!.payloadJson) as { secret: string };
  const delivery = secrets.open<Record<string, unknown>>(payload.secret);
  // Email first, even when a phone number exists, and no /consent/:id link.
  assert.equal(delivery.channel, "EMAIL");
  assert.equal(delivery.destination, "vivo@example.com");
  assert.equal(delivery.consentUrl, undefined);
  const email = renderEmail("consent-otp", {
    otp: delivery.otp,
    expiresAt: delivery.expiresAt,
  });
  assert.doesNotMatch(email.html, /\/consent\//);
  assert.match(email.text, /verification page/);
});

void test("confirming the code inside the link records consent for the case", async () => {
  const { service, confirmed } = harness();
  const result = await service.confirm("access-1", token, "123456");
  assert.equal(result.accepted, true);
  assert.deepEqual(confirmed, ["consent-1"]);
});

void test("consent is asked once: an accepted or withdrawn consent cannot be re-sent", async () => {
  await assert.rejects(
    harness("ACCEPTED").service.sendOtp("access-1", token),
    /already recorded/,
  );
  await assert.rejects(
    harness("WITHDRAWN").service.sendOtp("access-1", token),
    ConflictException,
  );
});

void test("uploads stay locked until the candidate confirms consent", async () => {
  const { prisma } = harness("REQUESTED");
  const portal = new CandidatePortalService(
    prisma,
    {} as DocumentsService,
    config,
    secrets,
    pii,
    {} as RequesterSupportRequestsService,
  );
  await assert.rejects(
    portal.upload("access-1", token, "PAN", {} as never, undefined, "x"),
    /Confirm your consent/,
  );
});

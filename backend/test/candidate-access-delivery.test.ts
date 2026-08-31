import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import { SubjectPiiService } from "../src/common/security/subject-pii.service";
import { CandidatePortalService } from "../src/candidate-portal/candidate-portal.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { DocumentsService } from "../src/documents/documents.service";
import type { CandidateAccessDelivery } from "../src/outbox/outbox-worker.types";

const actor = {
  tenantId: 7n,
  tenantPublicId: "2296f108-d071-4850-88f7-9b18bbb81e39",
  tenantName: "Sapling Global",
  userId: 11n,
  userPublicId: "71fb6f14-4ef3-4a7e-84ec-2197bc818eae",
  email: "client@greencall.com",
  displayName: "Client Admin",
  mustChangePassword: false,
  roles: ["CLIENT_ADMIN"],
  permissions: ["consent:manage"],
} satisfies Actor;

void test("candidate access queues an encrypted, expiring delivery", async () => {
  let outboxPayload = "";
  const accessId = "e93031a2-809f-4caa-934e-a35110cfb835";
  const tx = {
    candidatePortalAccess: {
      updateMany: () => ({ count: 1 }),
      create: () => ({ publicId: accessId }),
    },
    auditEvent: { create: () => ({}) },
    outboxEvent: {
      create: (input: { data: { payloadJson: string } }) => {
        outboxPayload = input.data.payloadJson;
        return {};
      },
    },
  };
  const prisma = {
    verificationCase: {
      findFirst: () => ({
        id: 33n,
        publicId: "5e678708-c21a-4482-a735-e5935f038287",
        subject: {
          email: "candidate@example.com",
          phone: "+919876543210",
          employeeCode: null,
          piiCiphertext: null,
          piiKeyVersion: null,
        },
      }),
    },
    $transaction: (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;
  const config = new ConfigService({
    WEB_ORIGIN: "https://verify.saplingglobal.in",
    JWT_REFRESH_SECRET: "test-refresh-secret-with-sufficient-entropy",
  });
  const secrets = new SecretBoxService(config);
  const service = new CandidatePortalService(
    prisma,
    {} as DocumentsService,
    config,
    secrets,
    new SubjectPiiService(secrets),
  );

  const result = await service.issue(
    actor,
    "5e678708-c21a-4482-a735-e5935f038287",
  );
  const envelope = JSON.parse(outboxPayload) as { secret: string };
  const delivery = secrets.open<CandidateAccessDelivery>(envelope.secret);

  assert.equal(result.delivery.queued, true);
  assert.equal(delivery.accessId, accessId);
  assert.equal(delivery.channel, "EMAIL");
  assert.equal(delivery.destination, "candidate@example.com");
  assert.match(delivery.portalUrl, /#token=/);
  assert.equal(outboxPayload.includes("candidate@example.com"), false);
  assert.equal(outboxPayload.includes(result.token), false);
  assert.ok(new Date(delivery.expiresAt) > new Date());
});

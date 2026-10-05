import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CandidatePortalService } from "../src/candidate-portal/candidate-portal.service";
import { IssueCandidateAccessDto } from "../src/candidate-portal/issue-candidate-access.dto";
import type { Actor } from "../src/common/auth/actor";

void test("copy-only access issues a revocable token without queuing notification; legacy calls retain delivery", async () => {
  let notifications = 0;
  let revocations = 0;
  const audits: string[] = [];
  const tx = {
    candidatePortalAccess: {
      updateMany: () => {
        revocations++;
        return Promise.resolve();
      },
      create: () => Promise.resolve({ publicId: "test-access" }),
    },
    auditEvent: {
      create: (args: { data: { afterJson: string } }) => {
        audits.push(args.data.afterJson);
        return Promise.resolve();
      },
    },
    outboxEvent: {
      create: () => {
        notifications++;
        return Promise.resolve();
      },
    },
  };
  const prisma = {
    verificationCase: {
      findFirst: () =>
        Promise.resolve({ id: 8n, publicId: "case-test", subject: {} }),
    },
    $transaction: (fn: (value: typeof tx) => unknown) => fn(tx),
  };
  type Args = ConstructorParameters<typeof CandidatePortalService>;
  const service = new CandidatePortalService(
    prisma as unknown as Args[0],
    {} as Args[1],
    { getOrThrow: () => "https://example.invalid" } as unknown as Args[2],
    { seal: () => "encrypted" } as unknown as Args[3],
    {
      open: () => ({ email: "candidate@example.invalid" }),
    } as unknown as Args[4],
    {} as Args[5],
  );
  const actor = {
    userId: 1n,
    tenantId: 2n,
    clientId: 3n,
    roles: ["CLIENT_ADMIN"],
    permissions: ["case:create"],
  } as Actor;
  const manual = await service.issue(actor, "case-test", false);
  assert.deepEqual(manual.delivery, { queued: false });
  assert.ok(manual.token.length >= 32);
  assert.equal(notifications, 0);
  assert.equal(revocations, 1);
  assert.equal(
    audits.some((entry) => entry.includes(manual.token)),
    false,
  );
  const legacy = await service.issue(actor, "case-test");
  assert.equal(legacy.delivery.queued, true);
  assert.equal(notifications, 1);
  assert.equal(revocations, 2);
});

void test("delivery choice only accepts actual booleans", async () => {
  assert.equal(
    (
      await validate(
        plainToInstance(IssueCandidateAccessDto, { sendNotification: false }),
      )
    ).length,
    0,
  );
  assert.equal(
    (
      await validate(
        plainToInstance(IssueCandidateAccessDto, { sendNotification: "false" }),
      )
    ).length,
    1,
  );
});

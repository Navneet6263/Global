import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { PrismaService } from "../src/database/prisma.service";
import { RmClientProfileController } from "../src/spoc/rm-client-profile.controller";
import { RmClientProfileService } from "../src/spoc/rm-client-profile.service";
import { passesGuard } from "./helpers/guard-check";
import { testActor } from "./helpers/test-actor";

const COMPANY = "00000000-0000-4000-8000-000000000040";
const OTHER = "00000000-0000-4000-8000-000000000041";
const rm = testActor(["SPOC_RM"], [], { spocClients: [{ id: 40n } as never] });

void test("the RM opens the profile; only the RM resets client logins here", () => {
  assert.ok(passesGuard(RmClientProfileController, "profile", rm));
  assert.ok(passesGuard(RmClientProfileController, "resetClientAdminPassword", rm));
  const ops = testActor(["OPS_MANAGER"], []);
  assert.ok(passesGuard(RmClientProfileController, "profile", ops));
  // Operations resets IDs from its own directory (under the Admin's delegation switch).
  assert.ok(!passesGuard(RmClientProfileController, "resetClientAdminPassword", ops));
  assert.ok(!passesGuard(RmClientProfileController, "profile", testActor(["VERIFIER"], ["*"])));
});

/** Fake database: one company (id 40) assigned to the RM, and its users. */
function harness(users: Array<{ publicId: string; status: string; roles: string[] }>) {
  const outbox: Array<{ payloadJson: string }> = [];
  const audits: Array<{ action: string; afterJson?: string }> = [];
  const tx = {
    user: {
      update: () => Promise.resolve({ email: "hr@acme.in", displayName: "Acme HR" }),
    },
    refreshSession: { updateMany: () => Promise.resolve({ count: 0 }) },
    outboxEvent: {
      create: ({ data }: { data: { payloadJson: string } }) => {
        outbox.push(data);
        return Promise.resolve({});
      },
    },
    auditEvent: {
      create: ({ data }: { data: { action: string; afterJson?: string } }) => {
        audits.push(data);
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    client: {
      // rmClient: only id 40 is in the RM's scope.
      findFirst: ({ where }: { where: { publicId: string; id: { in: bigint[] } } }) =>
        Promise.resolve(
          where.publicId === COMPANY && where.id.in.includes(40n)
            ? { id: 40n, publicId: COMPANY, displayName: "Acme" }
            : null,
        ),
    },
    user: {
      findFirst: ({ where }: { where: { publicId: string; clientId: bigint } }) => {
        const row = users.find((user) => user.publicId === where.publicId);
        return Promise.resolve(
          row && where.clientId === 40n
            ? {
                id: 7n,
                status: row.status,
                userRoles: row.roles.map((code) => ({ role: { code } })),
              }
            : null,
        );
      },
    },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  };
  const service = new RmClientProfileService(
    prisma as unknown as PrismaService,
    { get: () => "https://portal.example" } as unknown as ConfigService,
    { seal: (value: unknown) => JSON.stringify(value) } as unknown as SecretBoxService,
  );
  return { service, outbox, audits };
}

const PASSWORD = "Tmp#4821xyzA";

void test("the RM resets its company's Client Admin and the password is emailed", async () => {
  const { service, outbox, audits } = harness([
    { publicId: "u-admin", status: "ACTIVE", roles: ["CLIENT_ADMIN"] },
  ]);
  const result = await service.resetClientAdminPassword(rm, COMPANY, "u-admin", PASSWORD);
  assert.deepEqual(result, { reset: true, emailed: true });
  assert.equal(outbox.length, 1);
  assert.match(outbox[0]!.payloadJson, /password-reset/);
  assert.equal(audits[0]!.action, "user.password.reset");
  assert.deepEqual(JSON.parse(audits[0]!.afterJson!), {
    via: "RM",
    company: "Acme",
    emailed: true,
  });
});

void test("another RM's company, an internal login or a suspended login is refused", async () => {
  const { service, outbox } = harness([
    { publicId: "u-staff", status: "ACTIVE", roles: ["VERIFIER"] },
    { publicId: "u-off", status: "SUSPENDED", roles: ["CLIENT_ADMIN"] },
  ]);
  await assert.rejects(
    service.resetClientAdminPassword(rm, OTHER, "u-admin", PASSWORD),
    NotFoundException,
  );
  await assert.rejects(
    service.resetClientAdminPassword(rm, COMPANY, "u-staff", PASSWORD),
    (error: unknown) =>
      error instanceof ConflictException && /Only this company's Client Admin/.test(error.message),
  );
  await assert.rejects(
    service.resetClientAdminPassword(rm, COMPANY, "u-off", PASSWORD),
    /suspended/,
  );
  await assert.rejects(
    service.resetClientAdminPassword(rm, COMPANY, "u-missing", PASSWORD),
    NotFoundException,
  );
  assert.equal(outbox.length, 0);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import { AuthenticationService } from "../src/auth/authentication.service";
import type { AuthTokenService } from "../src/auth/auth-token.service";
import { hashPassword } from "../src/auth/password";
import { SessionManagementService } from "../src/auth/session-management.service";
import type { PrismaService } from "../src/database/prisma.service";

const actor: Actor = {
  userId: 10n,
  userPublicId: "00000000-0000-4000-8000-000000000010",
  tenantId: 1n,
  tenantPublicId: "00000000-0000-4000-8000-000000000001",
  tenantName: "Sapling Global",
  email: "admin@greencall.com",
  displayName: "Platform Admin",
  sessionPublicId: "00000000-0000-4000-8000-000000000003",
  mustChangePassword: false,
  roles: ["PLATFORM_ADMIN"],
  permissions: [],
};

void test("the fifth failed login applies lockout and records a security audit", async () => {
  const passwordHash = await hashPassword("Correct@1");
  const writes: Array<{ kind: string; value: unknown }> = [];
  const tx = {
    user: {
      update: (value: unknown) => {
        writes.push({ kind: "user", value });
        return Promise.resolve(value);
      },
    },
    auditEvent: {
      create: (value: unknown) => {
        writes.push({ kind: "audit", value });
        return Promise.resolve(value);
      },
    },
  };
  const user = {
    id: 10n,
    publicId: actor.userPublicId,
    tenantId: 1n,
    status: "ACTIVE",
    failedLoginCount: 4,
    lockedUntil: null,
    passwordHash,
  };
  const prisma = {
    withTransientReadRetry: (work: () => Promise<unknown>) => work(),
    user: { findFirst: () => Promise.resolve(user) },
    $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
  };
  const service = new AuthenticationService(
    prisma as unknown as PrismaService,
    {} as AuthTokenService,
  );

  await assert.rejects(
    service.login(
      {
        tenantCode: "SAPLING",
        email: "admin@greencall.com",
        password: "Wrong@1",
      },
      { ipAddress: "127.0.0.1" },
    ),
    UnauthorizedException,
  );
  const userWrite = writes.find((write) => write.kind === "user")?.value as {
    data?: { failedLoginCount?: number; lockedUntil?: Date };
  };
  const auditWrite = writes.find((write) => write.kind === "audit")?.value as {
    data?: { action?: string; afterJson?: string };
  };
  assert.equal(userWrite.data?.failedLoginCount, 5);
  assert.ok(userWrite.data?.lockedUntil instanceof Date);
  assert.equal(auditWrite.data?.action, "auth.login.failed");
  assert.match(auditWrite.data?.afterJson ?? "", /"locked":true/);
});

void test("revoke other sessions keeps the current refresh family active", async () => {
  const currentFamily = "00000000-0000-4000-8000-000000000004";
  let revokedWhere: unknown;
  let auditAction: string | undefined;
  const tx = {
    refreshSession: {
      updateMany: ({ where }: { where: unknown }) => {
        revokedWhere = where;
        return Promise.resolve({ count: 3 });
      },
    },
    auditEvent: {
      create: ({ data }: { data: { action?: string } }) => {
        auditAction = data.action;
        return Promise.resolve(data);
      },
    },
  };
  const prisma = {
    refreshSession: {
      findFirst: () => Promise.resolve({ familyId: currentFamily }),
    },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  };
  const service = new SessionManagementService(
    prisma as unknown as PrismaService,
  );

  const result = await service.revokeOthers(actor);

  assert.deepEqual(result, { revoked: 3 });
  assert.deepEqual(revokedWhere, {
    userId: actor.userId,
    revokedAt: null,
    familyId: { not: currentFamily },
  });
  assert.equal(auditAction, "auth.sessions.others-revoked");
});

void test("revoking the current device revokes its whole family", async () => {
  const familyId = "00000000-0000-4000-8000-000000000005";
  let revokedWhere: unknown;
  const tx = {
    refreshSession: {
      updateMany: ({ where }: { where: unknown }) => {
        revokedWhere = where;
        return Promise.resolve({ count: 2 });
      },
    },
    auditEvent: { create: (value: unknown) => Promise.resolve(value) },
  };
  const prisma = {
    refreshSession: {
      findFirst: () => Promise.resolve({ familyId }),
    },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  };
  const service = new SessionManagementService(
    prisma as unknown as PrismaService,
  );

  const result = await service.revoke(actor, actor.sessionPublicId!);

  assert.deepEqual(result, { revoked: 2, current: true });
  assert.deepEqual(revokedWhere, {
    userId: actor.userId,
    familyId,
    revokedAt: null,
  });
});

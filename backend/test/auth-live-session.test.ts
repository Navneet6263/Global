import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AccessTokenPayload } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { JwtStrategy } from "../src/auth/jwt.strategy";

const payload: AccessTokenPayload = {
  type: "access",
  sub: "user-a",
  tenantId: "tenant-a",
  sessionId: "session-a",
  email: "user@example.test",
};
const record = {
  userId: 1n,
  userPublicId: "user-a",
  tenantId: 2n,
  tenantPublicId: "tenant-a",
  tenantName: "Fixture",
  email: "user@example.test",
  displayName: "Fixture user",
  mustChangePassword: false,
  roleCode: "OPS_MANAGER",
  permissionsJson: '["case:read"]',
};
function strategy(read: () => Promise<unknown[]>) {
  return new JwtStrategy(
    new ConfigService({
      JWT_ACCESS_SECRET: "test-secret-not-used-to-sign-real-tokens",
    }),
    { $queryRaw: read } as unknown as PrismaService,
  );
}

void test("requests after revocation or suspension cannot reuse a cached actor", async () => {
  let available = true;
  const service = strategy(() => Promise.resolve(available ? [record] : []));
  assert.equal((await service.validate(payload)).userPublicId, "user-a");
  available = false;
  await assert.rejects(service.validate(payload), UnauthorizedException);
});

void test("role and password restrictions are reloaded on the next request", async () => {
  let current = record;
  const service = strategy(() => Promise.resolve([current]));
  assert.deepEqual((await service.validate(payload)).permissions, [
    "case:read",
  ]);
  current = { ...record, permissionsJson: "[]", mustChangePassword: true };
  const restricted = await service.validate(payload);
  assert.deepEqual(restricted.permissions, []);
  assert.equal(restricted.mustChangePassword, true);
});

void test("a request after revocation does not share an older in-flight lookup", async () => {
  let finish!: (value: unknown[]) => void;
  let reads = 0;
  const service = strategy(() =>
    ++reads === 1
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve([]),
  );
  const beforeRevocation = service.validate(payload);
  await assert.rejects(service.validate(payload), UnauthorizedException);
  finish([record]);
  await beforeRevocation;
  assert.equal(reads, 2);
});

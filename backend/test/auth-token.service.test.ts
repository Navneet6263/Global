import assert from "node:assert/strict";
import { test } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { AuthTokenService } from "../src/auth/auth-token.service";
import type { PrismaService } from "../src/database/prisma.service";

const USER_ID = "00000000-0000-4000-8000-000000000010";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const BRANCH_ID = "00000000-0000-4000-8000-000000000002";
const SESSION_ID = "00000000-0000-4000-8000-000000000003";
const FAMILY_ID = "00000000-0000-4000-8000-000000000004";

function config(): ConfigService {
  return {
    getOrThrow: (key: string) => `${key}-value`,
    get: (_key: string, fallback: unknown) => fallback,
  } as ConfigService;
}

function session(revokedAt: Date | null = null) {
  return {
    id: 7n,
    userId: 10n,
    familyId: FAMILY_ID,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt,
    user: {
      id: 10n,
      publicId: USER_ID,
      tenantId: 1n,
      email: "admin@greencall.com",
      status: "ACTIVE",
      tenant: { id: 1n, publicId: TENANT_ID },
      branch: { publicId: BRANCH_ID },
    },
  };
}

function jwt(payloadType = "refresh") {
  const signed: Array<Record<string, unknown>> = [];
  const service = {
    verifyAsync: () =>
      Promise.resolve({
        sub: USER_ID,
        tenantId: TENANT_ID,
        sessionId: SESSION_ID,
        type: payloadType,
      }),
    signAsync: (payload: Record<string, unknown>) => {
      signed.push(payload);
      return Promise.resolve(
        payload.type === "access" ? "access-signed" : "refresh-signed",
      );
    },
  };
  return { service: service as unknown as JwtService, signed };
}

void test("refresh rotation preserves family, branch claims and session metadata", async () => {
  const created: Array<Record<string, unknown>> = [];
  const prisma = {
    refreshSession: {
      findFirst: () => Promise.resolve(session()),
      updateMany: () => Promise.resolve({ count: 1 }),
      create: ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve(data);
      },
    },
  };
  const jwtMock = jwt();
  const service = new AuthTokenService(
    prisma as unknown as PrismaService,
    jwtMock.service,
    config(),
  );

  const result = await service.refresh("original-refresh", {
    ipAddress: "127.0.0.1",
    userAgent: "test-browser",
  });

  assert.equal(result.accessToken, "access-signed");
  assert.equal(result.refreshToken, "refresh-signed");
  assert.equal(created[0]?.familyId, FAMILY_ID);
  assert.equal(created[0]?.userAgent, "test-browser");
  assert.equal(created[0]?.ipAddress, "127.0.0.1");
  assert.equal(jwtMock.signed[0]?.branchId, BRANCH_ID);
  assert.equal(jwtMock.signed[1]?.branchId, BRANCH_ID);
});

void test("a lost concurrent refresh rotation revokes the entire token family", async () => {
  const writes: Array<{ kind: string; value: unknown }> = [];
  const tx = {
    refreshSession: {
      updateMany: (value: unknown) => {
        writes.push({ kind: "family", value });
        return Promise.resolve({ count: 1 });
      },
    },
    user: { findUnique: () => Promise.resolve({ publicId: USER_ID }) },
    auditEvent: {
      create: (value: unknown) => {
        writes.push({ kind: "audit", value });
        return Promise.resolve(value);
      },
    },
  };
  const prisma = {
    refreshSession: {
      findFirst: () => Promise.resolve(session()),
      updateMany: () => Promise.resolve({ count: 0 }),
    },
    $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
  };
  const service = new AuthTokenService(
    prisma as unknown as PrismaService,
    jwt().service,
    config(),
  );

  await assert.rejects(
    service.refresh("already-rotated", {}),
    (error: unknown) =>
      error instanceof UnauthorizedException &&
      /family revoked/.test(error.message),
  );
  const familyWrite = writes.find((write) => write.kind === "family")
    ?.value as { where?: { familyId?: string } };
  const auditWrite = writes.find((write) => write.kind === "audit")?.value as {
    data?: { action?: string };
  };
  assert.equal(familyWrite.where?.familyId, FAMILY_ID);
  assert.equal(auditWrite.data?.action, "auth.refresh-token-reuse-detected");
});

void test("an access token cannot be used as a refresh token", async () => {
  const service = new AuthTokenService(
    {} as PrismaService,
    jwt("access").service,
    config(),
  );
  await assert.rejects(
    service.refresh("access-token", {}),
    (error: unknown) =>
      error instanceof UnauthorizedException &&
      error.message === "Invalid token type",
  );
});

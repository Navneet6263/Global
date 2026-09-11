import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import { IdempotencyInterceptor } from "../src/common/http/idempotency.interceptor";
import { IdempotencyCleanupService } from "../src/common/http/idempotency-cleanup.service";
import { readUploadedBinary } from "../src/common/http/uploaded-binary";
import type { PrismaService } from "../src/database/prisma.service";
import type { Actor } from "../src/common/auth/actor";

function config(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: (key: string, fallback?: unknown) =>
      Object.hasOwn(values, key) ? values[key] : fallback,
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`${key} missing`);
      return value;
    },
  } as ConfigService;
}

void test("secret boxes retain old key versions during controlled rotation", () => {
  const oldKey = "old-data-key-0123456789abcdef0123456789";
  const newKey = "new-data-key-0123456789abcdef0123456789";
  const oldBox = new SecretBoxService(
    config({ DATA_ENCRYPTION_KEY: oldKey, DATA_ENCRYPTION_KEY_VERSION: 1 }),
  );
  const legacy = oldBox.seal({ candidate: "private" });
  const rotated = new SecretBoxService(
    config({
      DATA_ENCRYPTION_KEY: newKey,
      DATA_ENCRYPTION_KEY_VERSION: 2,
      DATA_ENCRYPTION_PREVIOUS_KEYS: JSON.stringify({ 1: oldKey }),
    }),
  );
  assert.deepEqual(rotated.open(legacy), { candidate: "private" });
  assert.match(rotated.seal({ current: true }), /^v2\./);
});

void test("idempotent responses are encrypted and replay without plaintext tokens", async () => {
  type RecordShape = Record<string, unknown> & {
    expiresAt: Date;
    responseCode?: number;
    responseCiphertext?: string;
    responseKeyVersion?: number;
  };
  let record: RecordShape | null = null;
  const store = {
    findUnique: () => Promise.resolve(record),
    delete: () => {
      record = null;
      return Promise.resolve({});
    },
    create: ({ data }: { data: RecordShape }) => {
      record = { ...data };
      return Promise.resolve(record);
    },
    update: ({ data }: { data: Record<string, unknown> }) => {
      record = { ...(record as RecordShape), ...data };
      return Promise.resolve(record);
    },
    deleteMany: () => Promise.resolve({ count: 1 }),
  };
  const prisma = { idempotencyKey: store } as unknown as PrismaService;
  const secrets = new SecretBoxService(
    config({ DATA_ENCRYPTION_KEY: "data-key-0123456789abcdef0123456789abcd" }),
  );
  const interceptor = new IdempotencyInterceptor(prisma, secrets);
  const actor = {
    tenantId: 1n,
    userPublicId: "00000000-0000-4000-8000-000000000001",
  } as Actor;
  const request = {
    method: "POST",
    url: "/api/v1/cases/00000000-0000-4000-8000-000000000002/candidate-access",
    user: actor,
    body: {},
    headers: { "idempotency-key": "candidate-token-test-0001" },
  };
  const response = {
    statusCode: 201,
    headers: {} as Record<string, string>,
    header(name: string, value: string) {
      this.headers[name] = value;
    },
    code(value: number) {
      this.statusCode = value;
    },
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  const secretResponse = { id: "access", token: "raw-portal-token" };
  const first = await lastValueFrom(
    await interceptor.intercept(context, {
      handle: () => of(secretResponse),
    } as CallHandler),
  );
  assert.deepEqual(first, secretResponse);
  const stored = await store.findUnique();
  assert.ok(stored, "the encrypted response must be persisted before replay");
  assert.equal(stored.responseJson, null);
  assert.doesNotMatch(stored.responseCiphertext ?? "", /raw-portal-token/);

  const replay = await lastValueFrom(
    await interceptor.intercept(context, {
      handle: () => {
        throw new Error("handler must not run for replay");
      },
    } as CallHandler),
  );
  assert.deepEqual(replay, secretResponse);
  assert.equal(response.headers["x-idempotent-replay"], "true");
});

void test("multipart idempotency requires and verifies a payload digest", async () => {
  const interceptor = new IdempotencyInterceptor(
    { idempotencyKey: {} } as PrismaService,
    new SecretBoxService(
      config({
        DATA_ENCRYPTION_KEY: "data-key-0123456789abcdef0123456789abcd",
      }),
    ),
  );
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: "POST",
        url: "/documents/id/content",
        user: { tenantId: 1n, userPublicId: "user" },
        headers: {
          "idempotency-key": "multipart-request-0001",
          "content-type": "multipart/form-data; boundary=test",
        },
      }),
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
  await assert.rejects(
    interceptor.intercept(context, { handle: () => of({}) } as CallHandler),
    BadRequestException,
  );

  const request = {
    headers: { "x-content-sha256": "0".repeat(64) },
    file: () =>
      Promise.resolve({
        fieldname: "file",
        mimetype: "application/pdf",
        filename: "proof.pdf",
        file: { truncated: false },
        toBuffer: () => Promise.resolve(Buffer.from("different bytes")),
      }),
  };
  await assert.rejects(
    readUploadedBinary(request as never, 1024),
    ConflictException,
  );
});

void test("expired idempotency rows are cleaned globally", async () => {
  let where: unknown;
  const service = new IdempotencyCleanupService(
    {
      idempotencyKey: {
        deleteMany: (input: { where: unknown }) => {
          where = input.where;
          return Promise.resolve({ count: 4 });
        },
      },
    } as unknown as PrismaService,
    config(),
  );
  assert.equal(await service.run(), 4);
  assert.ok(where);
});

void test("field evidence semantic headers are part of the idempotency identity", async () => {
  let record: Record<string, unknown> | null = null;
  const store = {
    findUnique: () => Promise.resolve(record),
    create: ({ data }: { data: Record<string, unknown> }) => {
      record = { ...data };
      return Promise.resolve(record);
    },
    update: ({ data }: { data: Record<string, unknown> }) => {
      record = { ...record, ...data };
      return Promise.resolve(record);
    },
    deleteMany: () => Promise.resolve({ count: 1 }),
  };
  const interceptor = new IdempotencyInterceptor(
    { idempotencyKey: store } as unknown as PrismaService,
    new SecretBoxService(
      config({
        DATA_ENCRYPTION_KEY: "data-key-0123456789abcdef0123456789abcd",
      }),
    ),
  );
  const request = {
    method: "POST",
    url: "/api/v1/field-visits/visit/evidence",
    user: { tenantId: 1n, userPublicId: "field-user" },
    headers: {
      "idempotency-key": "field-evidence-request-0001",
      "content-type": "multipart/form-data; boundary=test",
      "x-content-sha256": "a".repeat(64),
      "x-captured-at": "2026-08-27T10:00:00.000Z",
      "x-evidence-id": "00000000-0000-4000-8000-000000000010",
    },
  };
  const reply = {
    statusCode: 201,
    header: () => undefined,
    code: () => undefined,
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
    }),
  } as unknown as ExecutionContext;
  await lastValueFrom(
    await interceptor.intercept(context, {
      handle: () => of({ id: "evidence" }),
    } as CallHandler),
  );
  request.headers["x-captured-at"] = "2026-08-27T10:01:00.000Z";
  await assert.rejects(
    interceptor.intercept(context, {
      handle: () => of({ id: "evidence" }),
    } as CallHandler),
    ConflictException,
  );
});

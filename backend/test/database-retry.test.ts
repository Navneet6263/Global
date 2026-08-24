import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../src/database/prisma.service";

function service(): PrismaService {
  return new PrismaService(
    new ConfigService({
      DB_HOST: "localhost",
      DB_PORT: 1433,
      DB_NAME: "Sapling Global",
      DB_USER: "test-user",
      DB_PASSWORD: "test-password",
    }),
  );
}

void test("transient database reads retry once", async () => {
  const prisma = service();
  let attempts = 0;
  const result = await prisma.withTransientReadRetry(() => {
    attempts += 1;
    if (attempts === 1) {
      return Promise.reject(
        Object.assign(new Error("Failed to connect"), { code: "ETIMEOUT" }),
      );
    }
    return Promise.resolve("connected");
  });
  assert.equal(result, "connected");
  assert.equal(attempts, 2);
});

void test("non-transient database errors are never retried", async () => {
  const prisma = service();
  let attempts = 0;
  await assert.rejects(
    prisma.withTransientReadRetry(() => {
      attempts += 1;
      throw new Error("invalid query");
    }),
    /invalid query/,
  );
  assert.equal(attempts, 1);
});

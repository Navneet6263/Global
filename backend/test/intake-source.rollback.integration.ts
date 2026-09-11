import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/database/prisma.service";
import { intakeSourceFixture } from "./helpers/intake-source-fixture";
import { sourceMethodScenario } from "./helpers/source-method-scenario";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
const prisma = new PrismaClient({
  adapter: new PrismaMssql({
    server: required("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 1433),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    },
    pool: { max: 1, min: 0 },
  }),
});
const tenantCode = `INTAKE_${randomUUID().slice(0, 12)}`;
const sentinel = new Error("ROLLBACK_INTAKE_SOURCE_SUCCESS");
const objects = new Map<string, Buffer>();

async function run(tx: Prisma.TransactionClient) {
  const db = new Proxy(tx, {
    get(target, property) {
      if (property === "$transaction")
        return (
          work:
            | ((client: Prisma.TransactionClient) => Promise<unknown>)
            | Promise<unknown>[],
        ) => (typeof work === "function" ? work(tx) : Promise.all(work));
      return Reflect.get(target, property);
    },
  }) as unknown as PrismaService;
  const fixture = await intakeSourceFixture(tx, db, tenantCode, objects);
  await sourceMethodScenario(tx, db, fixture);
  assert.equal(objects.size, 3);
  assert.equal(
    await tx.outboxEvent.count({
      where: {
        tenantId: fixture.tenant.id,
        status: { in: ["PROCESSED", "PROCESSING"] },
      },
    }),
    0,
  );
  throw sentinel;
}

async function main() {
  try {
    let failure: unknown;
    try {
      await prisma.$transaction(run, {
        timeout: 180_000,
        maxWait: 10_000,
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (error !== sentinel) failure = error;
    }
    assert.equal(await prisma.tenant.count({ where: { code: tenantCode } }), 0);
    if (failure)
      throw failure instanceof Error
        ? failure
        : new Error("Intake source integration failed", { cause: failure });
    console.log(
      "PASS: SQL multi-service intake, OTP consent/queued receipt, real PDF upload/review/start, three methods/exact evidence, correction/reverification/task completion/QA routing; fixture tenant count 0 after rollback; files memory-only; no provider/worker delivery.",
    );
  } finally {
    objects.clear();
    await prisma.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Intake source test failed",
  );
  process.exitCode = 1;
});

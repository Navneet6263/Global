import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import { deliveryWorkflowFixture } from "./delivery-workflow-fixture";

export type CommercialFixture = Awaited<
  ReturnType<typeof deliveryWorkflowFixture>
>;
export async function rollbackDatabase(
  run: (
    tx: Prisma.TransactionClient,
    db: PrismaService,
    f: CommercialFixture,
  ) => Promise<void>,
) {
  for (const key of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"])
    if (!process.env[key]) throw new Error(`${key} is required`);
  const prisma = new PrismaClient({
    adapter: new PrismaMssql({
      server: process.env.DB_HOST!,
      port: Number(process.env.DB_PORT ?? 1433),
      database: process.env.DB_NAME!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      options: {
        encrypt: process.env.DB_ENCRYPT !== "false",
        trustServerCertificate:
          process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
      },
      pool: { max: 1, min: 0 },
    }),
  });
  const code = `COMMERCIAL_${randomUUID().slice(0, 12)}`;
  const sentinel = new Error("ROLLBACK_COMMERCIAL_SUCCESS");
  let reachedEnd = false;
  try {
    let failure: unknown;
    try {
      await prisma.$transaction(
        async (tx) => {
          // Preserve nested service rollback semantics while guaranteeing no fixture commits.
          let checkpoint = 0;
          const db = new Proxy(tx, {
            get(target, key) {
              if (key === "$transaction")
                return async (
                  work:
                    | ((client: Prisma.TransactionClient) => Promise<unknown>)
                    | Promise<unknown>[],
                ) => {
                  const savepoint = `fixture_${++checkpoint}`;
                  await tx.$executeRawUnsafe(`SAVE TRANSACTION ${savepoint}`);
                  try {
                    return await (typeof work === "function"
                      ? work(tx)
                      : Promise.all(work));
                  } catch (error) {
                    await tx.$executeRawUnsafe(
                      `ROLLBACK TRANSACTION ${savepoint}`,
                    );
                    throw error;
                  }
                };
              return Reflect.get(target, key);
            },
          }) as unknown as PrismaService;
          await run(tx, db, await deliveryWorkflowFixture(tx, code));
          reachedEnd = true;
          throw sentinel;
        },
        { timeout: 180_000, maxWait: 10_000, isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error !== sentinel) failure = error;
    }
    assert.equal(await prisma.tenant.count({ where: { code } }), 0);
    if (failure)
      throw failure instanceof Error
        ? failure
        : new Error("Rollback integration failed", { cause: failure });
    assert.ok(reachedEnd);
    console.log(
      "PASS: commercial/source SQL workflow; all fixture rows rolled back (tenant count 0).",
    );
  } finally {
    await prisma.$disconnect();
  }
}

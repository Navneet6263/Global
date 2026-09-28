import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { SpocBuckets } from "../src/spoc/spoc-buckets";
import { roleStatus } from "../src/spoc/spoc-role-status";
import { SpocWorkRecordsService } from "../src/spoc/spoc-work-records.service";
import { SpocTaskQueryDto } from "../src/spoc/dto/spoc-query.dto";

const actor = {
  tenantId: 7n,
  roles: ["PLATFORM_ADMIN"],
  permissions: ["*"],
} as unknown as Actor;

/** Fake Prisma that records every where-clause passed to count/findMany. */
function recordingPrisma() {
  const calls: Array<{ model: string; where: unknown }> = [];
  const model = (name: string) => ({
    count: (args: { where: unknown }) => {
      calls.push({ model: name, where: args.where });
      return Promise.resolve(0);
    },
    findMany: (args: { where: unknown }) => {
      calls.push({ model: name, where: args.where });
      return Promise.resolve([]);
    },
  });
  const prisma = new Proxy(
    {},
    { get: (_target, name: string) => model(name) },
  ) as unknown as PrismaService;
  return { prisma, calls };
}

void test("verifier matrix counts use the same where-clause as the drill-down list", async () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const range = { from: new Date("2026-08-26T10:00:00Z"), to: now };
  const matrix = recordingPrisma();
  await roleStatus(matrix.prisma, {
    tenantId: 7n,
    caseWhere: { tenantId: 7n },
    range,
    now,
  });
  const matrixTaskWheres = matrix.calls
    .filter((call) => call.model === "checkTask")
    .map((call) =>
      JSON.stringify(call.where, (_k, v: unknown) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    );
  assert.equal(matrixTaskWheres.length, SpocBuckets.length);

  for (const bucket of ["pending", "inProgress", "exceptions"] as const) {
    const list = recordingPrisma();
    const query = Object.assign(new SpocTaskQueryDto(), {
      bucket,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
    await new SpocWorkRecordsService(list.prisma).tasks(actor, query);
    const listCount = list.calls.find(
      (call) => call.model === "checkTask" && call.where,
    );
    const bucketPart = JSON.stringify(
      (listCount!.where as { AND: unknown[] }).AND[1],
      (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v),
    );
    assert.ok(
      matrixTaskWheres.some((where) => where.includes(bucketPart)),
      `${bucket} list filter must match the matrix count filter`,
    );
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaService } from "../src/database/prisma.service";
import { companyActivity } from "../src/onboarding/onboarding-activity";

function prismaWith(rows: Array<{ action: string; afterJson: string | null }>) {
  const calls: Array<{
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
  }> = [];
  const prisma = {
    auditEvent: {
      findMany: (args: {
        where: Record<string, unknown>;
        skip: number;
        take: number;
      }) => {
        calls.push(args);
        return Promise.resolve(
          rows.map((row, index) => ({
            id: BigInt(index + 1),
            action: row.action,
            afterJson: row.afterJson,
            createdAt: new Date("2026-10-07T10:00:00Z"),
            actor: {
              displayName: "Niku",
              userRoles: [{ role: { name: "RM / SPOC" } }],
            },
          })),
        );
      },
      count: () => Promise.resolve(18),
    },
    clientAgreement: {
      findMany: () => Promise.resolve([{ publicId: "agr-1", type: "PAN" }]),
    },
    servicePackage: {
      findMany: () =>
        Promise.resolve([{ publicId: "pkg-1", name: "Standard BGV" }]),
    },
  } as unknown as PrismaService;
  return { prisma, calls };
}

void test("activity pages, filters by kind and shows plain details, never raw JSON", async () => {
  const { prisma, calls } = prismaWith([
    {
      action: "client.agreement-file.reviewed",
      afterJson: JSON.stringify({
        agreementId: "agr-1",
        status: "APPROVED",
        notes: "ok",
      }),
    },
    {
      action: "client-pricing.discount-set",
      afterJson: JSON.stringify({
        packageId: "pkg-1",
        discountPercent: 10,
        note: "Volume",
      }),
    },
    { action: "client.self-signup", afterJson: "not json" },
  ]);
  const result = await companyActivity(prisma, {
    tenantId: 7n,
    clientPublicId: "client-1",
    page: 2,
    pageSize: 8,
    kind: "DOCUMENTS",
  });
  assert.equal(calls[0]!.skip, 8);
  assert.equal(calls[0]!.take, 8);
  assert.deepEqual(calls[0]!.where.action, {
    in: [
      "client.agreement-file.uploaded",
      "client.agreement-file.reviewed",
      "client.agreement-file.downloaded",
    ],
  });
  assert.equal(result.total, 18);
  assert.equal(result.items[0]!.detail, "Company PAN card · approved");
  assert.equal(result.items[0]!.outcome, "good");
  assert.equal(result.items[1]!.detail, "Standard BGV · 10% discount · Volume");
  assert.equal(result.items[1]!.kind, "PRICING");
  assert.equal(result.items[2]!.detail, null);
  assert.equal(result.items[0]!.byRole, "RM / SPOC");
  assert.doesNotMatch(JSON.stringify(result), /agr-1|sha256|"notes"/);
});

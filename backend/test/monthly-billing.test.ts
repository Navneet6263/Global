import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { MonthlyBillingService } from "../src/finance/monthly-billing.service";
import { previousIstMonth } from "../src/finance/payment-follow-up";
import { RmPaymentsService } from "../src/finance/rm-payments.service";

const now = new Date("2026-10-01T04:00:00Z"); // 1 Oct, 09:30 IST
const config = { get: () => undefined } as unknown as ConfigService;

void test("the month that closes is the previous IST month", () => {
  const month = previousIstMonth(now);
  assert.equal(month.period, "2026-09");
  assert.equal(month.from.toISOString(), "2026-08-31T18:30:00.000Z");
  assert.equal(month.to.toISOString(), "2026-09-30T18:30:00.000Z");
});

function billingTx(state: { closed?: number; reminders?: Date[] } = {}) {
  const notices: Array<{ userId: bigint; type: string; title: string }> = [];
  const audits: string[] = [];
  const tx = {
    auditEvent: {
      count: () => state.closed ?? 0,
      findMany: () =>
        (state.reminders ?? []).map((createdAt) => ({ createdAt })),
      create: (args: { data: { action: string } }) =>
        audits.push(args.data.action),
    },
    report: { count: () => 2 },
    invoice: {
      findMany: () => [
        { totalAmount: 1180, paidAmount: 180, creditedAmount: 0 },
      ],
    },
    client: { findUnique: () => ({ primaryRmUserId: 11n }) },
    spocClientScope: { findMany: () => [{ userId: 11n }, { userId: 12n }] },
    user: {
      findMany: (args: { where: { clientId?: bigint } }) =>
        args.where.clientId
          ? [{ id: 21n, email: "admin@client.test" }]
          : [{ id: 31n }],
    },
    notification: {
      createMany: (args: {
        data: Array<{ userId: bigint; type: string; title: string }>;
      }) => notices.push(...args.data),
    },
  };
  return { tx, notices, audits };
}

void test("month close tells the company's RMs to collect and Finance to bill, once", async () => {
  const { tx, notices, audits } = billingTx();
  const prisma = {
    client: {
      findMany: () => [
        {
          id: 9n,
          publicId: "client-1",
          tenantId: 1n,
          displayName: "Vision India",
        },
      ],
    },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const service = new MonthlyBillingService(prisma, config);
  assert.equal(await service.closeMonth(now), 1);
  const rm = notices.filter((notice) =>
    notice.title.startsWith("Month closed: ask"),
  );
  assert.deepEqual(
    rm.map((notice) => notice.userId),
    [11n, 12n],
    "primary RM and SPOC-RM, no duplicates",
  );
  assert.ok(
    notices.some(
      (notice) => notice.userId === 31n && notice.title.includes("bill"),
    ),
  );
  assert.deepEqual(audits, ["billing.month-closed"]);
  const again = billingTx({ closed: 1 });
  const prismaAgain = {
    ...prisma,
    $transaction: (work: (client: typeof again.tx) => unknown) =>
      work(again.tx),
  } as unknown as PrismaService;
  assert.equal(
    await new MonthlyBillingService(prismaAgain, config).closeMonth(now),
    0,
  );
});

function overdueService(reminders: Date[]) {
  const state = billingTx({ reminders });
  const prisma = {
    invoice: {
      findMany: () => [
        {
          id: 4n,
          publicId: "inv-1",
          tenantId: 1n,
          clientId: 9n,
          invoiceNumber: "INV-9",
          totalAmount: 1180,
          paidAmount: 180,
          creditedAmount: 0,
          client: { publicId: "client-1", displayName: "Vision India" },
        },
      ],
    },
    $transaction: (work: (client: typeof state.tx) => unknown) =>
      work(state.tx),
  } as unknown as PrismaService;
  return { service: new MonthlyBillingService(prisma, config), ...state };
}

void test("an overdue invoice reminds the company admins and the RM every 3 days", async () => {
  const first = overdueService([]);
  assert.equal(await first.service.remindOverdue(now), 1);
  assert.ok(
    first.notices.some(
      (n) => n.userId === 21n && n.type === "PAYMENT_REMINDER",
    ),
  );
  assert.ok(
    first.notices.some((n) => n.userId === 11n && n.type === "PAYMENT_OVERDUE"),
  );
  assert.deepEqual(first.audits, ["billing.payment-auto-reminder"]);
  const tooSoon = overdueService([new Date(now.getTime() - 86_400_000)]);
  assert.equal(await tooSoon.service.remindOverdue(now), 0);
});

void test("the RM reminds only its own companies, and not twice in 12 hours", async () => {
  const audits: string[] = [];
  let recent: object | null = null;
  const notices: unknown[] = [];
  const tx = {
    user: { findMany: () => [{ id: 21n, email: "admin@client.test" }] },
    notification: {
      createMany: (args: { data: unknown[] }) => notices.push(...args.data),
    },
    auditEvent: {
      create: (args: { data: { action: string } }) =>
        audits.push(args.data.action),
    },
  };
  const prisma = {
    client: {
      findFirst: (args: { where: { id?: { in: bigint[] } } }) => {
        assert.deepEqual(
          args.where.id,
          { in: [9n] },
          "limited to the RM's companies",
        );
        return {
          id: 9n,
          publicId: "client-1",
          invoices: [
            {
              invoiceNumber: "INV-9",
              totalAmount: 1180,
              paidAmount: 180,
              creditedAmount: 0,
            },
          ],
        };
      },
    },
    auditEvent: { findFirst: () => recent },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const rm = {
    tenantId: 1n,
    userId: 11n,
    roles: ["SPOC_RM"],
    spocClients: [{ id: 9n }],
  } as unknown as Actor;
  const service = new RmPaymentsService(prisma);
  const result = await service.remind(rm, "client-1", "Month of September");
  assert.equal(result.outstanding, 1000);
  assert.equal(notices.length, 1);
  assert.deepEqual(audits, ["billing.payment-reminder"]);
  recent = { id: 1n };
  await assert.rejects(service.remind(rm, "client-1"), /last 12 hours/);
  const noCompany = { ...rm, spocClients: [] } as unknown as Actor;
  await assert.rejects(service.remind(noCompany, "client-1"), /No companies/);
});

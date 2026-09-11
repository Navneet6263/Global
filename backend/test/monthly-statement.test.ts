import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { MonthlyStatementService } from "../src/finance/monthly-statement.service";
import {
  buildMonthlyStatement,
  invoiceStatementDate,
  monthlyStatementCsv,
  statementMoney,
  statementPeriod,
  type StatementEntry,
} from "../src/finance/monthly-statement-data";

const entry = (
  at: string,
  type: StatementEntry["type"],
  debit: bigint,
  credit = 0n,
): StatementEntry => ({
  at: new Date(at),
  type,
  reference: type,
  invoice: "INV-1",
  debit,
  credit,
});

void test("statement uses an India calendar month and preserves exact paise balances", () => {
  const month = statementPeriod("2026-09");
  assert.equal(month.start.toISOString(), "2026-08-31T18:30:00.000Z");
  assert.equal(month.end.toISOString(), "2026-09-30T18:30:00.000Z");
  assert.equal(
    invoiceStatementDate(new Date("2026-09-01"), new Date()).getTime(),
    month.start.getTime(),
  );
  const result = buildMonthlyStatement(
    [
      entry("2026-08-01", "INVOICE", 10000n),
      entry("2026-08-20", "PAYMENT", 0n, 2000n),
      entry("2026-08-31T18:30:00Z", "PAYMENT", 0n, 1000n),
      entry("2026-09-10", "INVOICE", 5000n),
      entry("2026-09-12", "CREDIT_NOTE", 0n, 500n),
      entry("2026-09-15", "CANCELLATION", 0n, 5000n),
      entry("2026-09-30T18:30:00Z", "PAYMENT", 0n, 6500n),
    ],
    "2026-09",
  );
  assert.equal(result.opening, 8000n);
  assert.equal(result.rows.length, 4);
  assert.equal(result.closing, 6500n);
  assert.equal(statementMoney(result.closing), "65.00");
  assert.equal(statementMoney(-1n), "-0.01");
  assert.throws(() => statementPeriod("2026-13"), /calendar month/);
});

void test("monthly statement does not erase an older balance because cancellation happened later", () => {
  const result = buildMonthlyStatement(
    [
      entry("2026-08-01", "INVOICE", 10000n),
      entry("2026-10-01", "CANCELLATION", 0n, 10000n),
    ],
    "2026-09",
  );
  assert.equal(result.opening, 10000n);
  assert.equal(result.closing, 10000n);
  const output = monthlyStatementCsv([], "2026-09", {
    code: "C1",
    displayName: "=HYPERLINK(1)",
  });
  assert.ok(output.csv.includes("'="));
  assert.ok(output.csv.includes("Opening balance"));
  assert.ok(output.csv.includes("Closing balance"));
});

void test("statement cannot select another client or bypass role checks", async () => {
  let where: unknown;
  const prisma = {
    client: {
      findFirst: (input: { where: unknown }) => {
        where = input.where;
        return null;
      },
    },
  };
  const service = new MonthlyStatementService(
    Object.assign(prisma, {
      $transaction: (callback: (tx: unknown) => unknown) => callback(prisma),
    }) as unknown as PrismaService,
  );
  const actor = {
    tenantId: 1n,
    clientId: 2n,
    roles: ["CLIENT_ADMIN"],
  } as Actor;
  await assert.rejects(
    service.download(actor, { month: "2026-09", clientId: "other" }, true),
    /Client not found/,
  );
  assert.deepEqual(where, { tenantId: 1n, id: 2n, publicId: "other" });
  await assert.rejects(
    service.download(actor, { month: "2026-09", clientId: "other" }, false),
    /Finance access/,
  );
  await assert.rejects(
    service.download(
      { ...actor, clientId: undefined },
      { month: "2026-09" },
      true,
    ),
    /client workspace/,
  );
});

void test("statement refuses missing cancellation history instead of inventing a cancellation date", async () => {
  const prisma = {
    client: {
      findFirst: () => ({
        id: 2n,
        publicId: "client",
        code: "C1",
        displayName: "Client",
      }),
    },
    invoice: {
      findMany: () => [
        {
          publicId: "invoice",
          invoiceNumber: "INV-1",
          currency: "INR",
          status: "CANCELLED",
          totalAmount: 100,
          issuedAt: new Date("2026-08-01"),
          createdAt: new Date("2026-08-01"),
        },
      ],
    },
    payment: { findMany: () => [] },
    creditNote: { findMany: () => [] },
    auditEvent: { findMany: () => [] },
  };
  const service = new MonthlyStatementService(
    Object.assign(prisma, {
      $transaction: (callback: (tx: unknown) => unknown) => callback(prisma),
    }) as unknown as PrismaService,
  );
  await assert.rejects(
    service.download(
      { tenantId: 1n, clientId: 2n, roles: ["CLIENT_ADMIN"] } as Actor,
      { month: "2026-09" },
      true,
    ),
    /Cancellation history is missing/,
  );
});

import { BadRequestException, ConflictException } from "@nestjs/common";
import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { InvoiceCancellationService } from "../src/finance/invoice-cancellation.service";
import { InvoiceCreditService } from "../src/finance/invoice-credit.service";
import { InvoicePaymentService } from "../src/finance/invoice-payment.service";

const actor: Actor = {
  tenantId: 7n,
  tenantPublicId: "2296f108-d071-4850-88f7-9b18bbb81e39",
  tenantName: "Sapling Global",
  clientId: 22n,
  clientPublicId: "5ac1ea86-faf3-4446-b152-ea62e14b5c89",
  clientName: "GreenCall",
  userId: 11n,
  userPublicId: "71fb6f14-4ef3-4a7e-84ec-2197bc818eae",
  email: "finance@greencall.com",
  displayName: "Finance Manager",
  mustChangePassword: false,
  roles: ["FINANCE_MANAGER"],
  permissions: ["finance:write"],
};

void test("payment is scoped and atomically settles a mixed paid-credit invoice", async () => {
  let lookup: unknown;
  const writes: Array<{ kind: string; args: unknown }> = [];
  const tx = {
    invoice: {
      updateMany: (args: unknown) => {
        writes.push({ kind: "invoice", args });
        return { count: 1 };
      },
    },
    payment: {
      create: (args: unknown) => {
        writes.push({ kind: "payment", args });
        return {
          publicId: "47f1535d-c5ec-40dc-8fcb-c62a85d3bb93",
          amount: 700,
          method: "UPI",
          receivedAt: new Date("2026-08-27T09:00:00.000Z"),
        };
      },
    },
    auditEvent: {
      create: (args: unknown) => writes.push({ kind: "audit", args }),
    },
  };
  const prisma = {
    invoice: {
      findFirst: (args: unknown) => {
        lookup = args;
        return {
          id: 30n,
          status: "ISSUED",
          totalAmount: 1000,
          paidAmount: 200,
          creditedAmount: 100,
          version: 2,
        };
      },
    },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;

  const result = await new InvoicePaymentService(prisma).record(
    actor,
    "5d7518a5-70c5-45b6-86d1-81b8de869211",
    {
      amount: 700,
      method: "UPI",
      receivedAt: "2026-08-27T09:00:00.000Z",
      version: 2,
    },
  );

  assert.equal(result.invoiceStatus, "SETTLED");
  assert.equal(result.invoiceVersion, 3);
  assert.equal(result.paidAmount, 900);
  assert.deepEqual(
    writes.map((write) => write.kind),
    ["invoice", "payment", "audit"],
  );
  assert.equal(
    (lookup as { where: { tenantId: bigint; clientId: bigint } }).where
      .tenantId,
    actor.tenantId,
  );
  assert.equal(
    (lookup as { where: { tenantId: bigint; clientId: bigint } }).where
      .clientId,
    actor.clientId,
  );
  const invoiceWrite = writes[0]!.args as {
    where: { version: number };
    data: { status: string; paidAmount: number };
  };
  assert.equal(invoiceWrite.where.version, 2);
  assert.equal(invoiceWrite.data.status, "SETTLED");
  assert.equal(invoiceWrite.data.paidAmount, 900);
});

void test("concurrent payment update cannot create payment or audit rows", async () => {
  let sideEffectCount = 0;
  const tx = {
    invoice: { updateMany: () => ({ count: 0 }) },
    payment: { create: () => sideEffectCount++ },
    auditEvent: { create: () => sideEffectCount++ },
  };
  const prisma = {
    invoice: {
      findFirst: () => ({
        id: 30n,
        status: "ISSUED",
        totalAmount: 1000,
        paidAmount: 0,
        creditedAmount: 0,
        version: 2,
      }),
    },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;

  await assert.rejects(
    new InvoicePaymentService(prisma).record(
      actor,
      "5d7518a5-70c5-45b6-86d1-81b8de869211",
      {
        amount: 100,
        method: "UPI",
        receivedAt: "2026-08-27T09:00:00.000Z",
        version: 2,
      },
    ),
    ConflictException,
  );
  assert.equal(sideEffectCount, 0);
});

void test("credit note above remaining balance is rejected before transaction", async () => {
  let transactionCalled = false;
  const prisma = {
    invoice: {
      findFirst: () => ({
        id: 30n,
        invoiceNumber: "SG-20260827-ABC123",
        status: "PARTIALLY_PAID",
        totalAmount: 1000,
        paidAmount: 750,
        creditedAmount: 100,
        version: 4,
      }),
    },
    $transaction: () => {
      transactionCalled = true;
    },
  } as unknown as PrismaService;

  await assert.rejects(
    new InvoiceCreditService(prisma).create(
      actor,
      "5d7518a5-70c5-45b6-86d1-81b8de869211",
      { amount: 151, reason: "Commercial adjustment", version: 4 },
    ),
    BadRequestException,
  );
  assert.equal(transactionCalled, false);
});

void test("repeated cancellation is idempotent and does not duplicate audit", async () => {
  let transactionCalled = false;
  const prisma = {
    invoice: {
      findFirst: () => ({
        id: 30n,
        invoiceNumber: "SG-20260827-ABC123",
        status: "CANCELLED",
        paidAmount: 0,
        creditedAmount: 0,
        version: 5,
      }),
    },
    $transaction: () => {
      transactionCalled = true;
    },
  } as unknown as PrismaService;

  const result = await new InvoiceCancellationService(prisma).cancel(
    actor,
    "5d7518a5-70c5-45b6-86d1-81b8de869211",
    { reason: "Duplicate invoice", version: 5 },
  );

  assert.deepEqual(result, {
    id: "5d7518a5-70c5-45b6-86d1-81b8de869211",
    status: "CANCELLED",
    version: 5,
  });
  assert.equal(transactionCalled, false);
});

void test("paise arithmetic settles 0.10 plus 0.20 exactly", async () => {
  const tx = {
    invoice: { updateMany: () => ({ count: 1 }) },
    payment: {
      create: () => ({
        publicId: "47f1535d-c5ec-40dc-8fcb-c62a85d3bb93",
        amount: 0.2,
        method: "UPI",
        receivedAt: new Date("2026-08-27T09:00:00.000Z"),
      }),
    },
    auditEvent: { create: () => ({}) },
  };
  const prisma = {
    invoice: {
      findFirst: () => ({
        id: 30n,
        status: "PARTIALLY_PAID",
        totalAmount: "0.30",
        paidAmount: "0.10",
        creditedAmount: "0.00",
        version: 2,
      }),
    },
    $transaction: (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;
  const result = await new InvoicePaymentService(prisma).record(
    actor,
    "5d7518a5-70c5-45b6-86d1-81b8de869211",
    {
      amount: 0.2,
      method: "UPI",
      receivedAt: "2026-08-27T09:00:00.000Z",
      version: 2,
    },
  );
  assert.equal(result.invoiceStatus, "PAID");
  assert.equal(result.paidAmount, 0.3);
});

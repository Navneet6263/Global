import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import { rmClient, rmClientWhere } from "../src/common/auth/rm-client";
import type { PrismaService } from "../src/database/prisma.service";
import type { InvoicePaymentService } from "../src/finance/invoice-payment.service";
import { RmPaymentsService } from "../src/finance/rm-payments.service";
import type { RecordPaymentDto } from "../src/finance/dto/record-payment.dto";

const rm = {
  tenantId: 1n,
  userId: 50n,
  displayName: "Riya RM",
  roles: ["SPOC_RM"],
  spocClients: [{ id: 3n }],
} as unknown as Actor;
const ops = {
  tenantId: 1n,
  userId: 60n,
  roles: ["OPS_MANAGER"],
} as unknown as Actor;

const payment: RecordPaymentDto = {
  amount: 11800,
  method: "UPI",
  reference: "UTR-881",
  receivedAt: "2026-10-10",
  version: 2,
};

void test("an RM works only on its assigned companies; Operations sees all", async () => {
  assert.deepEqual(rmClientWhere(rm), { tenantId: 1n, id: { in: [3n] } });
  assert.deepEqual(rmClientWhere(ops), { tenantId: 1n });
  assert.deepEqual(
    rmClientWhere({ ...rm, spocClients: [] }),
    { tenantId: 1n, id: { in: [-1n] } },
  );
  const prisma = { client: { findFirst: () => null } };
  await assert.rejects(
    rmClient(prisma as never, rm, "client-x"),
    NotFoundException,
  );
});

void test("the RM records a payment on its company's invoice and Finance is told", async () => {
  const recorded: unknown[] = [];
  const notices: Array<{ data: Array<{ body: string; userId: bigint }> }> = [];
  let invoiceWhere: unknown;
  const prisma = {
    invoice: {
      findFirst: (args: { where: unknown }) => {
        invoiceWhere = args.where;
        return {
          publicId: "inv-1",
          invoiceNumber: "SG/26-27/0042",
          client: { displayName: "Horizon Tech" },
        };
      },
    },
    user: { findMany: () => [{ id: 70n }] },
    notification: {
      createMany: (args: (typeof notices)[number]) => notices.push(args),
    },
  } as unknown as PrismaService;
  const payments = {
    record: (...args: unknown[]) => {
      recorded.push(args);
      return { id: "inv-1", status: "PAID" };
    },
  } as unknown as InvoicePaymentService;
  const service = new RmPaymentsService(prisma, undefined, undefined, payments);
  const result = await service.recordPayment(rm, "inv-1", payment);
  assert.deepEqual(result, { id: "inv-1", status: "PAID" });
  assert.equal(recorded.length, 1);
  assert.deepEqual(invoiceWhere, {
    tenantId: 1n,
    publicId: "inv-1",
    clientId: { in: [3n] },
  });
  assert.equal(notices[0]!.data[0]!.userId, 70n);
  assert.match(
    notices[0]!.data[0]!.body,
    /Riya RM recorded ₹11,800 \(upi, ref UTR-881\) from Horizon Tech/,
  );
});

void test("an invoice of another company cannot be paid or downloaded by the RM", async () => {
  const prisma = {
    invoice: { findFirst: () => null },
  } as unknown as PrismaService;
  const service = new RmPaymentsService(prisma, undefined, undefined, {
    record: () => assert.fail("must not record"),
  } as unknown as InvoicePaymentService);
  await assert.rejects(
    service.recordPayment(rm, "inv-9", payment),
    NotFoundException,
  );
  await assert.rejects(service.invoicePdf(rm, "inv-9"), NotFoundException);
});

import { NotFoundException } from "@nestjs/common";
import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { InvoiceIssueService } from "../src/finance/invoice-issue.service";
import type { InvoicePdfService } from "../src/finance/invoice-pdf.service";

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

void test("invoice issue calculates subtotal and tax in integer paise", async () => {
  let clientLookup: unknown;
  let invoiceWrite: unknown;
  const auditWrites: unknown[] = [];
  const now = new Date("2026-08-27T10:00:00.000Z");
  const tx = {
    invoice: {
      create: (args: any) => {
        invoiceWrite = args;
        return {
          publicId: "5d7518a5-70c5-45b6-86d1-81b8de869211",
          invoiceNumber: args.data.invoiceNumber,
          status: "ISSUED",
          dueAt: args.data.dueAt,
          totalAmount: args.data.totalAmount,
        };
      },
    },
    auditEvent: {
      create: (args: unknown) => auditWrites.push(args),
    },
  };
  const prisma = {
    client: {
      findFirst: (args: unknown) => {
        clientLookup = args;
        return { id: 22n };
      },
    },
    verificationCase: { findMany: () => [] },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;

  const result = await new InvoiceIssueService(
    prisma,
    {} as InvoicePdfService,
  ).create(actor, {
    clientId: "5ac1ea86-faf3-4446-b152-ea62e14b5c89",
    dueAt: now.toISOString(),
    notes: "  Monthly verification invoice  ",
    lines: [
      {
        description: "  Background verification  ",
        quantity: 3,
        unitPrice: 99.99,
        taxRate: 18,
      },
    ],
  });

  const lookup = clientLookup as {
    where: { tenantId: bigint; publicId: string; id: bigint; status: string };
  };
  assert.equal(lookup.where.tenantId, actor.tenantId);
  assert.equal(lookup.where.id, actor.clientId);
  const write = invoiceWrite as {
    data: {
      subtotal: number;
      taxAmount: number;
      totalAmount: number;
      notes: string;
      lines: { create: Array<{ description: string; lineTotal: number }> };
    };
  };
  assert.equal(write.data.subtotal, 299.97);
  assert.equal(write.data.taxAmount, 53.99);
  assert.equal(write.data.totalAmount, 353.96);
  assert.equal(write.data.notes, "Monthly verification invoice");
  assert.equal(
    write.data.lines.create[0]!.description,
    "Background verification",
  );
  assert.equal(write.data.lines.create[0]!.lineTotal, 353.96);
  assert.equal(result.totalAmount, 353.96);
  assert.equal(auditWrites.length, 1);
  assert.equal(
    (auditWrites[0] as { data: { action: string } }).data.action,
    "finance.invoice.issued",
  );
});

void test("invoice issue rejects cases outside the selected client", async () => {
  let transactionCalled = false;
  const prisma = {
    client: { findFirst: () => ({ id: 22n }) },
    verificationCase: { findMany: () => [] },
    $transaction: () => {
      transactionCalled = true;
    },
  } as unknown as PrismaService;

  await assert.rejects(
    new InvoiceIssueService(prisma, {} as InvoicePdfService).create(actor, {
      clientId: "5ac1ea86-faf3-4446-b152-ea62e14b5c89",
      dueAt: "2026-09-27T10:00:00.000Z",
      lines: [
        {
          caseId: "ed502f32-e5d1-425f-a646-5fe8454ae47f",
          description: "Employment verification",
          quantity: 1,
          unitPrice: 1000,
          taxRate: 18,
        },
      ],
    }),
    NotFoundException,
  );
  assert.equal(transactionCalled, false);
});

import { queueEmail } from "../common/mail/queue-email";
import type { SecretBoxService } from "../common/security/secret-box.service";
import type { Prisma } from "../generated/prisma/client";
import type { InvoicePdfService } from "./invoice-pdf.service";

/** Everything the tax-invoice PDF needs. */
export const invoicePdfSelect = {
  invoiceNumber: true,
  status: true,
  annexureStatus: true,
  currency: true,
  issuedAt: true,
  dueAt: true,
  subtotal: true,
  taxAmount: true,
  totalAmount: true,
  paidAmount: true,
  creditedAmount: true,
  notes: true,
  createdAt: true,
  client: {
    select: {
      legalName: true,
      displayName: true,
      code: true,
      billingTerms: true,
      billingAddress: true,
      gstin: true,
    },
  },
  lines: {
    select: {
      description: true,
      quantity: true,
      unitPrice: true,
      taxRate: true,
      lineTotal: true,
      case: { select: { caseNumber: true } },
      report: { select: { releasedAt: true } },
    },
    orderBy: { id: "asc" },
  },
  payments: {
    select: { amount: true, method: true, receivedAt: true },
    orderBy: { receivedAt: "asc" },
  },
  creditNotes: {
    select: { noteNumber: true, amount: true, reason: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.InvoiceSelect;

export type InvoiceMailDeps = {
  secretBox: SecretBoxService;
  pdf: InvoicePdfService;
  webOrigin: string;
};

const IST_DATE = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * "Tax invoice issued" email, with the invoice PDF attached, to every active Client
 * Admin of the company. Queued in the issuing transaction (delivered by the outbox).
 */
export async function queueInvoiceIssuedEmails(
  tx: Prisma.TransactionClient,
  deps: InvoiceMailDeps,
  input: { tenantId: bigint; invoiceId: bigint },
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: input.invoiceId },
    select: { ...invoicePdfSelect, publicId: true, clientId: true },
  });
  if (!invoice) return 0;
  const admins = await tx.user.findMany({
    where: {
      tenantId: input.tenantId,
      clientId: invoice.clientId,
      status: "ACTIVE",
      userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
    },
    select: { email: true },
  });
  if (!admins.length) return 0;
  const pdf = await deps.pdf.render(invoice);
  const filename = `Sapling-Global-${invoice.invoiceNumber.replaceAll("/", "-")}.pdf`;
  for (const admin of admins)
    await queueEmail(tx, deps.secretBox, {
      tenantId: input.tenantId,
      aggregateType: "invoice",
      aggregateId: invoice.publicId,
      to: admin.email,
      template: "invoice-issued",
      variables: {
        companyName: invoice.client.displayName,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.totalAmount).toLocaleString("en-IN", {
          style: "currency",
          currency: "INR",
        }),
        dueDate: invoice.dueAt ? IST_DATE.format(invoice.dueAt) : "",
        url: `${deps.webOrigin}/client-portal/billing`,
      },
      attachments: [
        {
          filename,
          contentType: "application/pdf",
          base64: Buffer.from(pdf).toString("base64"),
        },
      ],
    });
  return admins.length;
}

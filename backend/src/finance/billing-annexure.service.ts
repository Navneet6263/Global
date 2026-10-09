import { roleIs } from "../common/auth/role-filter";
import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  StreamableFile,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../common/auth/actor";
import { queueEmail } from "../common/mail/queue-email";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { DispositionLabels, caseColour } from "../verification/dispositions";

export const ANNEXURE_AGEING_MS = 3 * 86_400_000;
const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const BOM = String.fromCharCode(0xfeff);
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

const annexureSelect = {
  id: true,
  publicId: true,
  invoiceNumber: true,
  status: true,
  issuedAt: true,
  subtotal: true,
  taxAmount: true,
  totalAmount: true,
  annexureStatus: true,
  annexureSentAt: true,
  annexureValidatedAt: true,
  annexureQuery: true,
  clientId: true,
  client: { select: { displayName: true } },
  lines: {
    orderBy: { id: "asc" },
    select: {
      description: true,
      quantity: true,
      unitPrice: true,
      taxRate: true,
      lineTotal: true,
      report: { select: { releasedAt: true } },
      case: {
        select: {
          caseNumber: true,
          completedAt: true,
          subject: { select: { fullName: true } },
          checks: { select: { result: true, disposition: true } },
        },
      },
    },
  },
} satisfies Prisma.InvoiceSelect;

type AnnexureInvoice = Prisma.InvoiceGetPayload<{
  select: typeof annexureSelect;
}>;

/**
 * Monthly billing annexure and bill validation (BGV process): one row per billed case
 * with its report colour code; Finance sends it, the company validates it or raises a
 * query, and an unvalidated annexure raises an ageing alert after 3 days.
 */
@Injectable()
export class BillingAnnexureService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly secretBox?: SecretBoxService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private where(actor: Actor, invoiceId: string): Prisma.InvoiceWhereInput {
    return {
      tenantId: actor.tenantId,
      publicId: invoiceId,
      ...(actor.clientId ? { clientId: actor.clientId } : {}),
    };
  }

  private async load(actor: Actor, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: this.where(actor, invoiceId),
      select: annexureSelect,
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (actor.clientId && invoice.status === "DRAFT")
      throw new NotFoundException("Invoice not found");
    return invoice;
  }

  private rows(invoice: AnnexureInvoice) {
    return invoice.lines.map((line) => {
      const colour = line.case ? caseColour(line.case.checks) : null;
      return {
        caseNumber: line.case?.caseNumber ?? "",
        candidateName: line.case?.subject.fullName ?? "",
        description: line.description,
        completedAt: line.case?.completedAt ?? null,
        releasedAt: line.report?.releasedAt ?? null,
        quantity: line.quantity,
        unitPrice: line.unitPrice.toFixed(2),
        taxRate: line.taxRate.toFixed(2),
        lineTotal: line.lineTotal.toFixed(2),
        colour,
        colourLabel: colour ? DispositionLabels[colour] : "",
      };
    });
  }

  async annexure(actor: Actor, invoiceId: string, now = new Date()) {
    const invoice = await this.load(actor, invoiceId);
    const rows = this.rows(invoice);
    const colours: Record<string, number> = {};
    for (const row of rows)
      colours[row.colour ?? "NONE"] = (colours[row.colour ?? "NONE"] ?? 0) + 1;
    return {
      invoice: {
        id: invoice.publicId,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        clientName: invoice.client.displayName,
        subtotal: invoice.subtotal.toFixed(2),
        taxAmount: invoice.taxAmount.toFixed(2),
        totalAmount: invoice.totalAmount.toFixed(2),
      },
      validation: {
        status: invoice.annexureStatus,
        sentAt: invoice.annexureSentAt,
        validatedAt: invoice.annexureValidatedAt,
        query: invoice.annexureQuery,
        ageing:
          invoice.annexureStatus === "PENDING" &&
          invoice.annexureSentAt !== null &&
          now.getTime() - invoice.annexureSentAt.getTime() >=
            ANNEXURE_AGEING_MS,
      },
      colours,
      rows,
    };
  }

  async annexureCsv(actor: Actor, invoiceId: string) {
    const invoice = await this.load(actor, invoiceId);
    const header = [
      "Sapling ID",
      "Candidate",
      "Service",
      "Completed",
      "Report released",
      "Qty",
      "Unit price",
      "GST %",
      "Amount",
      "Colour code",
    ];
    const lines = this.rows(invoice).map((row) =>
      [
        row.caseNumber,
        row.candidateName,
        row.description,
        row.completedAt ? IST.format(row.completedAt) : "",
        row.releasedAt ? IST.format(row.releasedAt) : "",
        String(row.quantity),
        row.unitPrice,
        row.taxRate,
        row.lineTotal,
        row.colourLabel,
      ]
        .map(cell)
        .join(","),
    );
    const totals = [
      ["", "", "Subtotal", "", "", "", "", "", invoice.subtotal.toFixed(2), ""],
      ["", "", "GST", "", "", "", "", "", invoice.taxAmount.toFixed(2), ""],
      ["", "", "Total", "", "", "", "", "", invoice.totalAmount.toFixed(2), ""],
    ].map((row) => row.map(cell).join(","));
    await this.audit(actor, invoice.publicId, "finance.annexure-downloaded", {
      invoiceNumber: invoice.invoiceNumber,
      rows: lines.length,
    });
    return new StreamableFile(
      Buffer.from(
        `${BOM}${[header.join(","), ...lines, ...totals].join("\r\n")}`,
      ),
      {
        type: "text/csv; charset=utf-8",
        disposition: `attachment; filename="Sapling-Global-annexure-${invoice.invoiceNumber}.csv"`,
      },
    );
  }

  /** Finance shares the annexure with the company for validation. */
  async send(actor: Actor, invoiceId: string, now = new Date()) {
    const invoice = await this.load(actor, invoiceId);
    if (["DRAFT", "CANCELLED"].includes(invoice.status))
      throw new ConflictException(
        "Issue the invoice before sending its annexure",
      );
    if (invoice.annexureStatus === "VALIDATED")
      throw new ConflictException("The company already validated this bill");
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          annexureStatus: "PENDING",
          annexureSentAt: now,
          annexureQuery: null,
          version: { increment: 1 },
        },
      });
      await this.notifyClient(tx, actor.tenantId, invoice, "sent");
      await this.audit(
        actor,
        invoice.publicId,
        "finance.annexure-sent",
        {
          invoiceNumber: invoice.invoiceNumber,
          resent: invoice.annexureStatus === "QUERIED",
        },
        tx,
      );
    });
    return { id: invoiceId, annexureStatus: "PENDING", annexureSentAt: now };
  }

  /** The company confirms the bill. */
  async validate(actor: Actor, invoiceId: string, now = new Date()) {
    const invoice = await this.load(actor, invoiceId);
    if (!["PENDING", "QUERIED"].includes(invoice.annexureStatus ?? ""))
      throw new ConflictException("There is no bill waiting for validation");
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          annexureStatus: "VALIDATED",
          annexureValidatedAt: now,
          version: { increment: 1 },
        },
      });
      await this.notifyFinance(
        tx,
        actor.tenantId,
        invoice,
        `${invoice.client.displayName} validated bill ${invoice.invoiceNumber}.`,
      );
      await this.audit(
        actor,
        invoice.publicId,
        "finance.annexure-validated",
        { invoiceNumber: invoice.invoiceNumber },
        tx,
      );
    });
    return {
      id: invoiceId,
      annexureStatus: "VALIDATED",
      annexureValidatedAt: now,
    };
  }

  /** The company raises a query on the bill instead of validating it. */
  async query(actor: Actor, invoiceId: string, text: string) {
    const invoice = await this.load(actor, invoiceId);
    if (invoice.annexureStatus !== "PENDING")
      throw new ConflictException("There is no bill waiting for validation");
    const note = text.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          annexureStatus: "QUERIED",
          annexureQuery: note,
          version: { increment: 1 },
        },
      });
      await this.notifyFinance(
        tx,
        actor.tenantId,
        invoice,
        `${invoice.client.displayName} raised a query on ${invoice.invoiceNumber}: ${note}`,
      );
      await this.audit(
        actor,
        invoice.publicId,
        "finance.annexure-queried",
        { invoiceNumber: invoice.invoiceNumber, query: note },
        tx,
      );
    });
    return { id: invoiceId, annexureStatus: "QUERIED" };
  }

  async notifyClient(
    tx: Prisma.TransactionClient,
    tenantId: bigint,
    invoice: Pick<AnnexureInvoice, "clientId" | "publicId" | "invoiceNumber">,
    kind: "sent" | "ageing",
  ) {
    const admins = await tx.user.findMany({
      where: {
        tenantId,
        clientId: invoice.clientId,
        status: "ACTIVE",
        userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
      },
      select: { id: true, email: true },
    });
    const title =
      kind === "sent"
        ? `Please validate bill ${invoice.invoiceNumber}`
        : `Reminder: bill ${invoice.invoiceNumber} is waiting for validation`;
    if (admins.length)
      await tx.notification.createMany({
        data: admins.map((admin) => ({
          tenantId,
          userId: admin.id,
          type: "BILL_VALIDATION",
          title,
          body: "Check the billing annexure and validate it or raise a query.",
          href: "/client-portal/billing",
        })),
      });
    const webOrigin = this.config?.get<string>("WEB_ORIGIN");
    if (this.secretBox && webOrigin)
      for (const admin of admins)
        await queueEmail(tx, this.secretBox, {
          tenantId,
          aggregateType: "invoice",
          aggregateId: invoice.publicId,
          to: admin.email,
          template: "onboarding-update",
          variables: {
            message: `${title}. Open Billing in your portal to see the annexure, then validate it or raise a query.`,
            url: `${webOrigin}/client-portal/billing`,
          },
        });
    return admins.length;
  }

  async notifyFinance(
    tx: Prisma.TransactionClient,
    tenantId: bigint,
    invoice: Pick<AnnexureInvoice, "invoiceNumber">,
    body: string,
  ) {
    const finance = await tx.user.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        userRoles: { some: { role: roleIs("FINANCE_MANAGER") } },
      },
      select: { id: true },
    });
    if (finance.length)
      await tx.notification.createMany({
        data: finance.map((user) => ({
          tenantId,
          userId: user.id,
          type: "BILL_VALIDATION",
          title: `Bill ${invoice.invoiceNumber}`,
          body: body.slice(0, 1000),
          href: "/finance/invoices",
        })),
      });
    return finance.length;
  }

  private audit(
    actor: Actor,
    invoiceId: string,
    action: string,
    after: Record<string, unknown>,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action,
        resourceType: "invoice",
        resourcePublicId: invoiceId,
        afterJson: JSON.stringify(after),
      },
    });
  }
}

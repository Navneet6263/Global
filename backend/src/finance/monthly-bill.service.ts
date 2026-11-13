import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../common/auth/actor";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { BillingAnnexureService } from "./billing-annexure.service";
import { toPaise } from "./finance.shared";
import { nextInvoiceNumber } from "./gst";
import { allocateInvoiceReports } from "./invoice-report-allocation";
import {
  queueInvoiceIssuedEmails,
  type InvoiceMailDeps,
} from "./invoice-issued-email";
import { InvoicePdfService } from "./invoice-pdf.service";
import { unbilledReportWhere } from "./payment-follow-up";

/** "2026-10" to its Indian calendar month: [from, to) in UTC. */
export function istMonth(period: string) {
  const [year, month] = period.split("-").map(Number) as [number, number];
  const offset = 330 * 60_000;
  return {
    from: new Date(Date.UTC(year, month - 1, 1) - offset),
    to: new Date(Date.UTC(year, month, 1) - offset),
    label: new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1))),
  };
}

/** Marks a monthly bill (kept in the invoice notes, so the period survives issuing). */
export const monthlyBillNote = (period: string, cases: number, label: string) =>
  `Monthly bill ${period}: ${cases} ${cases === 1 ? "case" : "cases"} with reports released in ${label}.`;

type Skipped = { client: string; caseNumber?: string; reason: string };

/**
 * Monthly billing in three steps (BGV process):
 * 1. Prepare: every company's reports released in the month become a draft bill at the
 *    price each case was booked at, sent to the company to validate.
 * 2. The company validates the bill or raises a query (bill validation).
 * 3. Finance issues the validated bill as a tax invoice with the next GST number.
 */
@Injectable()
export class MonthlyBillService {
  private readonly logger = new Logger(MonthlyBillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly annexure: BillingAnnexureService,
    @Optional() private readonly pdf?: InvoicePdfService,
    @Optional() private readonly secretBox?: SecretBoxService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /** Email setup for the "tax invoice issued" mail; absent in unit tests. */
  private invoiceMail(): InvoiceMailDeps | undefined {
    const webOrigin = this.config?.get<string>("WEB_ORIGIN");
    return this.secretBox && this.pdf && webOrigin
      ? { secretBox: this.secretBox, pdf: this.pdf, webOrigin }
      : undefined;
  }

  /** Draft bills for the month; a company whose reports are all billed is left alone. */
  async prepare(
    tenantId: bigint,
    actorUserId: bigint | null,
    period: string,
    onlyClientId?: bigint,
  ) {
    const { from, to, label } = istMonth(period);
    const released = { releasedAt: { gte: from, lt: to } };
    const clients = await this.prisma.client.findMany({
      where: {
        tenantId,
        ...(onlyClientId ? { id: onlyClientId } : {}),
        // A completed case with a released, not yet billed report in the month.
        cases: {
          some: {
            status: { in: ["COMPLETED", "CLOSED"] },
            reports: {
              some: {
                ...released,
                workflowVersion: 2,
                status: "PUBLISHED",
                invoiceLines: {
                  none: { invoice: { status: { not: "CANCELLED" } } },
                },
              },
            },
          },
        },
      },
      select: { id: true, publicId: true, code: true, displayName: true },
      take: 500,
    });
    const prepared: Array<{
      client: string;
      invoiceId: string;
      cases: number;
      total: number;
    }> = [];
    const skipped: Skipped[] = [];
    for (const client of clients) {
      try {
        const bill = await this.prepareClient(
          tenantId,
          actorUserId,
          period,
          label,
          client,
          released,
          skipped,
        );
        if (bill) prepared.push(bill);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Could not prepare the bill";
        this.logger.warn(
          `Monthly bill for ${client.displayName} (${period}): ${reason}`,
        );
        skipped.push({ client: client.displayName, reason });
      }
    }
    return { period, label, prepared, skipped };
  }

  private async prepareClient(
    tenantId: bigint,
    actorUserId: bigint | null,
    period: string,
    label: string,
    client: { id: bigint; publicId: string; code: string; displayName: string },
    released: Prisma.ReportWhereInput,
    skipped: Skipped[],
  ) {
    const reports = await this.prisma.report.findMany({
      where: { tenantId, ...unbilledReportWhere(client.id), ...released },
      orderBy: { releasedAt: "asc" },
      select: {
        publicId: true,
        case: {
          select: {
            id: true,
            caseNumber: true,
            services: {
              select: {
                unitPrice: true,
                taxRate: true,
                servicePackage: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    // One line per booked service of each case, at the price the case was booked at.
    const lines = reports.flatMap((report) => {
      const services = report.case.services;
      if (
        !services.length ||
        services.every((service) => toPaise(service.unitPrice) <= 0)
      ) {
        skipped.push({
          client: client.displayName,
          caseNumber: report.case.caseNumber,
          reason:
            "No price on record for this case; bill it from Ready for billing",
        });
        return [];
      }
      return services.map((service) => {
        const baseCents = toPaise(service.unitPrice);
        const rate = Number(service.taxRate);
        return {
          caseId: report.case.id,
          reportPublicId: report.publicId,
          description:
            `Background Verification - ${service.servicePackage.name}`.slice(
              0,
              300,
            ),
          quantity: 1,
          unitPrice: baseCents / 100,
          taxRate: rate,
          baseCents,
          taxCents: Math.round((baseCents * rate) / 100),
        };
      });
    });
    if (!lines.length) return null;
    const subtotalCents = lines.reduce((sum, line) => sum + line.baseCents, 0);
    const taxCents = lines.reduce((sum, line) => sum + line.taxCents, 0);
    // The invoice total is rounded to the rupee; the PDF shows the difference.
    const totalCents = Math.round((subtotalCents + taxCents) / 100) * 100;
    const cases = new Set(lines.map((line) => line.caseId)).size;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const reportIds = await allocateInvoiceReports(
        tx,
        tenantId,
        client.id,
        lines,
      );
      const invoiceNumber = await draftNumber(
        tx,
        tenantId,
        period,
        client.code,
      );
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          clientId: client.id,
          invoiceNumber,
          status: "DRAFT",
          subtotal: subtotalCents / 100,
          taxAmount: taxCents / 100,
          totalAmount: totalCents / 100,
          notes: monthlyBillNote(period, cases, label),
          annexureStatus: "PENDING",
          annexureSentAt: now,
          lines: {
            create: lines.map((line, index) => ({
              caseId: line.caseId,
              reportId: reportIds[index],
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate,
              lineTotal: (line.baseCents + line.taxCents) / 100,
            })),
          },
        },
        select: {
          id: true,
          publicId: true,
          invoiceNumber: true,
          clientId: true,
        },
      });
      await this.annexure.notifyClient(tx, tenantId, invoice, "sent");
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorUserId,
          action: "finance.monthly-bill-prepared",
          resourceType: "invoice",
          resourcePublicId: invoice.publicId,
          afterJson: JSON.stringify({
            invoiceNumber,
            clientId: client.publicId,
            period,
            cases,
            totalAmount: totalCents / 100,
            sentForValidation: true,
          }),
        },
      });
      return {
        client: client.displayName,
        invoiceId: invoice.publicId,
        cases,
        total: totalCents / 100,
      };
    });
  }

  /** The month's bills, newest first, with where each one is. */
  async list(actor: Actor, period: string) {
    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        notes: { startsWith: `Monthly bill ${period}:` },
      },
      orderBy: { createdAt: "desc" },
      select: {
        publicId: true,
        invoiceNumber: true,
        status: true,
        version: true,
        issuedAt: true,
        dueAt: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        annexureStatus: true,
        annexureSentAt: true,
        annexureValidatedAt: true,
        annexureQuery: true,
        createdAt: true,
        client: { select: { publicId: true, displayName: true, gstin: true } },
        lines: { select: { caseId: true } },
      },
    });
    return {
      period,
      label: istMonth(period).label,
      items: rows.map((row) => ({
        id: row.publicId,
        invoiceNumber: row.invoiceNumber,
        status: row.status,
        version: row.version,
        issuedAt: row.issuedAt,
        dueAt: row.dueAt,
        subtotal: Number(row.subtotal),
        taxAmount: Number(row.taxAmount),
        totalAmount: Number(row.totalAmount),
        // Distinct cases: a case with two services has two lines.
        cases: new Set(row.lines.map((line) => String(line.caseId))).size,
        validation: {
          status: row.annexureStatus,
          sentAt: row.annexureSentAt,
          validatedAt: row.annexureValidatedAt,
          query: row.annexureQuery,
        },
        client: {
          id: row.client.publicId,
          name: row.client.displayName,
          gstin: row.client.gstin,
        },
        createdAt: row.createdAt,
      })),
    };
  }

  /** A bill the company validated becomes a tax invoice with the next GST number. */
  async issue(
    actor: Actor,
    invoiceId: string,
    input: { version: number; dueAt?: string },
  ) {
    const bill = await this.prisma.invoice.findFirst({
      where: { tenantId: actor.tenantId, publicId: invoiceId },
      select: {
        id: true,
        clientId: true,
        status: true,
        version: true,
        invoiceNumber: true,
        annexureStatus: true,
        totalAmount: true,
        client: { select: { displayName: true } },
      },
    });
    if (!bill) throw new NotFoundException("Bill not found");
    if (bill.status !== "DRAFT")
      throw new ConflictException("This bill is already issued or cancelled");
    if (bill.annexureStatus !== "VALIDATED")
      throw new ConflictException(
        "Issue the tax invoice after the company validates the bill",
      );
    if (bill.version !== input.version)
      throw new ConflictException("The bill changed; refresh and try again");
    const issuedAt = new Date();
    const dueAt = input.dueAt
      ? new Date(input.dueAt)
      : new Date(issuedAt.getTime() + 30 * 86_400_000);
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const invoiceNumber = await nextInvoiceNumber(
            tx,
            actor.tenantId,
            issuedAt,
          );
          const updated = await tx.invoice.updateMany({
            where: { id: bill.id, status: "DRAFT", version: input.version },
            data: {
              status: "ISSUED",
              invoiceNumber,
              issuedAt,
              dueAt,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1)
            throw new ConflictException(
              "The bill changed; refresh and try again",
            );
          await tx.auditEvent.create({
            data: {
              tenantId: actor.tenantId,
              actorUserId: actor.userId,
              action: "finance.invoice.issued",
              resourceType: "invoice",
              resourcePublicId: invoiceId,
              afterJson: JSON.stringify({
                invoiceNumber,
                draftNumber: bill.invoiceNumber,
                totalAmount: Number(bill.totalAmount),
                fromValidatedBill: true,
              }),
            },
          });
          const admins = await tx.user.findMany({
            where: {
              tenantId: actor.tenantId,
              clientId: bill.clientId,
              status: "ACTIVE",
              userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
            },
            select: { id: true },
          });
          if (admins.length)
            await tx.notification.createMany({
              data: admins.map((admin) => ({
                tenantId: actor.tenantId,
                userId: admin.id,
                type: "INVOICE_ISSUED",
                title: `Tax invoice ${invoiceNumber} issued`,
                body: `The bill you validated (${bill.invoiceNumber}) is now tax invoice ${invoiceNumber}.`,
                href: "/client-portal/billing",
              })),
            });
          // The company gets the tax invoice by email, PDF attached.
          const mail = this.invoiceMail();
          if (mail)
            await queueInvoiceIssuedEmails(tx, mail, {
              tenantId: actor.tenantId,
              invoiceId: bill.id,
            });
          return {
            id: invoiceId,
            invoiceNumber,
            status: "ISSUED",
            issuedAt,
            dueAt,
            version: input.version + 1,
          };
        });
      } catch (error) {
        // Two invoices issued at the same moment: take the next number and try again.
        const duplicate =
          typeof error === "object" &&
          error !== null &&
          (error as { code?: unknown }).code === "P2002";
        if (!duplicate || attempt >= 2) throw error;
      }
    }
  }
}

/** "BILL-2026-10-HORIZON", with -2, -3… when a second bill is made for the same month. */
async function draftNumber(
  tx: Prisma.TransactionClient,
  tenantId: bigint,
  period: string,
  code: string,
) {
  const base = `BILL-${period}-${code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20)}`;
  const taken = await tx.invoice.count({
    where: { tenantId, invoiceNumber: { startsWith: base } },
  });
  return taken ? `${base}-${taken + 1}` : base;
}

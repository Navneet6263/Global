import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { buyerState } from "./gst";
import { settledInvoiceStatuses } from "./finance.shared";

const money = (value: Prisma.Decimal | number | null | undefined) =>
  Number(new Prisma.Decimal(value ?? 0).toFixed(2));

/** Released reports of a company that no live invoice or bill covers yet. */
export function unbilledReportsWhere(tenantId: bigint, clientId: bigint) {
  return {
    tenantId,
    workflowVersion: 2,
    OR: [
      { status: "PREPARED", case: { status: "PAYMENT_PENDING" } },
      {
        status: "PUBLISHED",
        case: { status: { in: ["COMPLETED", "CLOSED"] } },
      },
    ],
    invoiceLines: { none: { invoice: { status: { not: "CANCELLED" } } } },
    case: { clientId },
  } satisfies Prisma.ReportWhereInput;
}

/**
 * Everything Finance needs while writing a company's invoice: GST type, account
 * position, monthly bills still with the company, and each released report not yet
 * billed with its booked price (so a line can be added in one click).
 */
@Injectable()
export class BillingContextService {
  constructor(private readonly prisma: PrismaService) {}

  async forClient(actor: Actor, clientPublicId: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: clientPublicId,
        ...(actor.clientId ? { id: actor.clientId } : {}),
      },
      select: {
        id: true,
        publicId: true,
        displayName: true,
        legalName: true,
        gstin: true,
        creditLimit: true,
        creditHold: true,
      },
    });
    if (!client) throw new NotFoundException("Company not found");
    const now = new Date();
    const live = {
      tenantId: actor.tenantId,
      clientId: client.id,
      status: { notIn: ["CANCELLED", "DRAFT"] },
      currency: "INR",
    } satisfies Prisma.InvoiceWhereInput;
    const [totals, overdue, last, bills, reports] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: live,
        _sum: { totalAmount: true, paidAmount: true, creditedAmount: true },
        _count: true,
      }),
      this.prisma.invoice.findMany({
        where: {
          ...live,
          status: { notIn: [...settledInvoiceStatuses, "DRAFT"] },
          dueAt: { lt: now },
        },
        select: { totalAmount: true, paidAmount: true, creditedAmount: true },
      }),
      this.prisma.invoice.findFirst({
        where: live,
        orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
        select: {
          invoiceNumber: true,
          issuedAt: true,
          dueAt: true,
          totalAmount: true,
          status: true,
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId: actor.tenantId,
          clientId: client.id,
          status: "DRAFT",
          annexureStatus: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          invoiceNumber: true,
          annexureStatus: true,
          totalAmount: true,
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.report.findMany({
        where: unbilledReportsWhere(actor.tenantId, client.id),
        orderBy: [{ createdAt: "asc" }, { publicId: "asc" }],
        take: 100,
        select: {
          publicId: true,
          releasedAt: true,
          createdAt: true,
          case: {
            select: {
              publicId: true,
              caseNumber: true,
              subject: { select: { fullName: true } },
              servicePackage: { select: { name: true, price: true } },
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
      }),
    ]);
    const gst = buyerState(client.gstin);
    const overdueAmount = overdue.reduce(
      (sum, row) =>
        sum +
        money(row.totalAmount) -
        money(row.paidAmount) -
        money(row.creditedAmount),
      0,
    );
    const outstanding =
      money(totals._sum.totalAmount) -
      money(totals._sum.paidAmount) -
      money(totals._sum.creditedAmount);
    const unbilled = reports.map((row) => {
      const services = row.case.services.length
        ? row.case.services.map((service) => ({
            description: `Background Verification - ${service.servicePackage.name}`,
            unitPrice: money(service.unitPrice),
            taxRate: Number(service.taxRate),
          }))
        : row.case.servicePackage
          ? [
              {
                description: `Background Verification - ${row.case.servicePackage.name}`,
                unitPrice: money(row.case.servicePackage.price),
                taxRate: 18,
              },
            ]
          : [];
      return {
        reportId: row.publicId,
        caseId: row.case.publicId,
        caseNumber: row.case.caseNumber,
        candidateName: row.case.subject.fullName,
        releasedAt: row.releasedAt ?? row.createdAt,
        lines: services,
      };
    });
    const unbilledTaxable = unbilled.reduce(
      (sum, item) =>
        sum + item.lines.reduce((lineSum, line) => lineSum + line.unitPrice, 0),
      0,
    );
    return {
      client: {
        id: client.publicId,
        name: client.displayName,
        legalName: client.legalName,
        gstin: client.gstin,
        state: gst.name,
        // CGST + SGST inside Uttar Pradesh, IGST outside it.
        tax: gst.intraState ? "CGST_SGST" : "IGST",
        creditLimit:
          client.creditLimit === null ? null : money(client.creditLimit),
        creditHold: client.creditHold,
      },
      account: {
        invoices: totals._count,
        billed: money(totals._sum.totalAmount),
        paid: money(totals._sum.paidAmount),
        outstanding: Number(outstanding.toFixed(2)),
        overdue: Number(overdueAmount.toFixed(2)),
        overdueInvoices: overdue.length,
        last: last
          ? {
              invoiceNumber: last.invoiceNumber,
              issuedAt: last.issuedAt,
              dueAt: last.dueAt,
              total: money(last.totalAmount),
              status:
                !settledInvoiceStatuses.includes(
                  last.status as (typeof settledInvoiceStatuses)[number],
                ) &&
                last.dueAt &&
                last.dueAt < now
                  ? "OVERDUE"
                  : last.status,
            }
          : null,
      },
      monthlyBills: bills.map((bill) => ({
        invoiceNumber: bill.invoiceNumber,
        validation: bill.annexureStatus,
        total: money(bill.totalAmount),
        lines: bill._count.lines,
      })),
      unbilled,
      unbilledTaxable: Number(unbilledTaxable.toFixed(2)),
    };
  }
}

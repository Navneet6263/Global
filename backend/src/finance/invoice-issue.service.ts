import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto";
import {
  invoiceSelect,
  isSettledInvoice,
  presentInvoice,
} from "./finance.shared";
import { InvoicePdfService } from "./invoice-pdf.service";
import { allocateInvoiceReports } from "./invoice-report-allocation";

@Injectable()
export class InvoiceIssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  async create(actor: Actor, input: CreateInvoiceDto) {
    if (!input.lines.length) {
      throw new BadRequestException("At least one invoice line is required");
    }
    const client = await this.prisma.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.clientId,
        ...(actor.clientId ? { id: actor.clientId } : {}),
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!client) throw new NotFoundException("Active client not found");

    const casePublicIds = input.lines.flatMap((line) =>
      line.caseId ? [line.caseId] : [],
    );
    const cases = casePublicIds.length
      ? await this.prisma.verificationCase.findMany({
          where: {
            tenantId: actor.tenantId,
            clientId: client.id,
            publicId: { in: casePublicIds },
          },
          select: { id: true, publicId: true },
        })
      : [];
    if (cases.length !== new Set(casePublicIds).size) {
      throw new NotFoundException(
        "One or more billed cases do not belong to this client",
      );
    }

    const caseIds = new Map(cases.map((item) => [item.publicId, item.id]));
    const lines = input.lines.map((line) => {
      const unitCents = Math.round(line.unitPrice * 100);
      const baseCents = unitCents * line.quantity;
      const taxCents = Math.round(baseCents * (line.taxRate / 100));
      return {
        caseId: line.caseId ? caseIds.get(line.caseId) : undefined,
        reportPublicId: line.reportId,
        description: line.description.trim(),
        quantity: line.quantity,
        unitPrice: unitCents / 100,
        taxRate: line.taxRate,
        baseCents,
        taxCents,
        lineTotal: (baseCents + taxCents) / 100,
      };
    });
    const subtotalCents = lines.reduce((sum, line) => sum + line.baseCents, 0);
    const taxCents = lines.reduce((sum, line) => sum + line.taxCents, 0);
    const subtotal = subtotalCents / 100;
    const taxAmount = taxCents / 100;
    const totalAmount = (subtotalCents + taxCents) / 100;
    const invoiceNumber = `SG-${dateToken()}-${randomToken()}`;

    return this.prisma.$transaction(async (tx) => {
      const reportIds = await allocateInvoiceReports(
        tx,
        actor.tenantId,
        client.id,
        lines,
      );
      const row = await tx.invoice.create({
        data: {
          tenantId: actor.tenantId,
          clientId: client.id,
          invoiceNumber,
          status: "ISSUED",
          issuedAt: new Date(),
          dueAt: new Date(input.dueAt),
          subtotal,
          taxAmount,
          totalAmount,
          notes: input.notes?.trim(),
          lines: {
            create: lines.map((line, index) => ({
              caseId: line.caseId,
              reportId: reportIds[index],
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate,
              lineTotal: line.lineTotal,
            })),
          },
        },
        select: invoiceSelect,
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "finance.invoice.issued",
          resourceType: "invoice",
          resourcePublicId: row.publicId,
          afterJson: JSON.stringify({
            invoiceNumber,
            totalAmount,
          }),
        },
      });
      return presentInvoice(row, new Date());
    });
  }

  async download(actor: Actor, publicId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
      },
      select: {
        invoiceNumber: true,
        status: true,
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
          },
          orderBy: { id: "asc" },
        },
        payments: {
          select: { amount: true, method: true, receivedAt: true },
          orderBy: { receivedAt: "asc" },
        },
        creditNotes: {
          select: {
            noteNumber: true,
            amount: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const contents = await this.invoicePdf.render({
      ...invoice,
      status:
        !isSettledInvoice(invoice.status) &&
        invoice.dueAt &&
        invoice.dueAt < new Date()
          ? "OVERDUE"
          : invoice.status,
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "finance.invoice.downloaded",
        resourceType: "invoice",
        resourcePublicId: publicId,
        afterJson: JSON.stringify({ invoiceNumber: invoice.invoiceNumber }),
      },
    });
    return new StreamableFile(contents, {
      type: "application/pdf",
      disposition: `attachment; filename="Sapling-Global-${invoice.invoiceNumber}.pdf"`,
    });
  }
}

function dateToken() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function randomToken() {
  return randomBytes(3).toString("hex").toUpperCase();
}

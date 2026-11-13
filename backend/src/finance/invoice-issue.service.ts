import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  StreamableFile,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SecretBoxService } from "../common/security/secret-box.service";
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
import { nextInvoiceNumber } from "./gst";
import {
  invoicePdfSelect,
  queueInvoiceIssuedEmails,
  type InvoiceMailDeps,
} from "./invoice-issued-email";

@Injectable()
export class InvoiceIssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicePdf: InvoicePdfService,
    @Optional() private readonly secretBox?: SecretBoxService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /** Email setup for the "tax invoice issued" mail; absent in unit tests. */
  private invoiceMail(): InvoiceMailDeps | undefined {
    const webOrigin = this.config?.get<string>("WEB_ORIGIN");
    return this.secretBox && webOrigin
      ? { secretBox: this.secretBox, pdf: this.invoicePdf, webOrigin }
      : undefined;
  }

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
    return this.prisma.$transaction(async (tx) => {
      // GST: one sequential series per financial year (SG/26-27/0001).
      const invoiceNumber = await nextInvoiceNumber(tx, actor.tenantId);
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
        select: { ...invoiceSelect, id: true },
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
      // The company gets the tax invoice by email, PDF attached.
      const { id: invoiceId, ...issued } = row;
      const mail = this.invoiceMail();
      if (mail)
        await queueInvoiceIssuedEmails(tx, mail, {
          tenantId: actor.tenantId,
          invoiceId,
        });
      return presentInvoice(issued, new Date());
    });
  }

  async download(actor: Actor, publicId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
      },
      select: invoicePdfSelect,
    });
    if (
      !invoice ||
      (actor.clientId && invoice.status === "DRAFT" && !invoice.annexureStatus)
    )
      throw new NotFoundException("Invoice not found");

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
      disposition: `attachment; filename="Sapling-Global-${invoice.invoiceNumber.replaceAll("/", "-")}.pdf"`,
    });
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { requireClientFinanceScope } from "./client-finance.scope";
import type { MonthlyStatementDto } from "./dto/monthly-statement.dto";
import {
  invoiceStatementDate,
  monthlyStatementCsv,
  statementPaise,
  statementPeriod,
  type StatementEntry,
} from "./monthly-statement-data";

@Injectable()
export class MonthlyStatementService {
  constructor(private readonly prisma: PrismaService) {}

  async download(actor: Actor, query: MonthlyStatementDto, ownClient: boolean) {
    if (ownClient) requireClientFinanceScope(actor);
    else if (
      !actor.roles.some((role) =>
        ["PLATFORM_ADMIN", "FINANCE_MANAGER"].includes(role),
      )
    )
      throw new ForbiddenException("Finance access is required");
    if (!ownClient && !query.clientId)
      throw new BadRequestException(
        "Choose a client for the monthly statement",
      );
    statementPeriod(query.month);
    return this.prisma.$transaction((tx) => this.export(tx, actor, query), {
      isolationLevel: "Serializable",
      timeout: 15_000,
    });
  }

  private async export(
    tx: Prisma.TransactionClient,
    actor: Actor,
    query: MonthlyStatementDto,
  ) {
    const client = await tx.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        ...(actor.clientId ? { id: actor.clientId } : {}),
        ...(query.clientId ? { publicId: query.clientId } : {}),
      },
      select: { id: true, publicId: true, code: true, displayName: true },
    });
    if (!client) throw new NotFoundException("Client not found");
    const period = statementPeriod(query.month);
    const scope = {
      tenantId: actor.tenantId,
      clientId: client.id,
      status: { not: "DRAFT" },
    };
    const [invoices, payments, credits] = await Promise.all([
      tx.invoice.findMany({
        where: {
          ...scope,
          OR: [
            { issuedAt: { lt: period.invoiceEnd } },
            { issuedAt: null, createdAt: { lt: period.end } },
          ],
        },
        select: {
          publicId: true,
          invoiceNumber: true,
          currency: true,
          status: true,
          issuedAt: true,
          createdAt: true,
          totalAmount: true,
        },
        take: 5_001,
      }),
      tx.payment.findMany({
        where: { invoice: scope, receivedAt: { lt: period.end } },
        select: {
          publicId: true,
          amount: true,
          receivedAt: true,
          invoice: { select: { invoiceNumber: true, currency: true } },
        },
        take: 10_001,
      }),
      tx.creditNote.findMany({
        where: {
          tenantId: actor.tenantId,
          invoice: scope,
          createdAt: { lt: period.end },
        },
        select: {
          noteNumber: true,
          amount: true,
          createdAt: true,
          invoice: { select: { invoiceNumber: true, currency: true } },
        },
        take: 10_001,
      }),
    ]);
    if (
      invoices.length > 5_000 ||
      payments.length > 10_000 ||
      credits.length > 10_000
    )
      throw new BadRequestException(
        "The statement exceeds the safe ledger export limit; ask Finance for an accounting-system extract",
      );
    if (
      invoices.some((row) => row.currency !== "INR") ||
      [...payments, ...credits].some((row) => row.invoice.currency !== "INR")
    )
      throw new BadRequestException(
        "Separate currency statements are required for non-INR accounts",
      );
    const entries: StatementEntry[] = invoices.map((row) => ({
      at: invoiceStatementDate(row.issuedAt, row.createdAt),
      type: "INVOICE",
      reference: row.invoiceNumber,
      invoice: row.invoiceNumber,
      debit: statementPaise(row.totalAmount),
      credit: 0n,
    }));
    for (const row of payments)
      entries.push({
        at: row.receivedAt,
        type: "PAYMENT",
        reference: row.publicId,
        invoice: row.invoice.invoiceNumber,
        debit: 0n,
        credit: statementPaise(row.amount),
      });
    for (const row of credits)
      entries.push({
        at: row.createdAt,
        type: "CREDIT_NOTE",
        reference: row.noteNumber,
        invoice: row.invoice.invoiceNumber,
        debit: 0n,
        credit: statementPaise(row.amount),
      });
    const cancelled = invoices.filter((row) => row.status === "CANCELLED");
    for (let offset = 0; offset < cancelled.length; offset += 200) {
      const batch = cancelled.slice(offset, offset + 200);
      const events = await tx.auditEvent.findMany({
        where: {
          tenantId: actor.tenantId,
          action: "finance.invoice.cancelled",
          resourceType: "invoice",
          resourcePublicId: { in: batch.map((row) => row.publicId) },
        },
        select: { resourcePublicId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      for (const invoice of batch) {
        const event = events.find(
          (row) => row.resourcePublicId === invoice.publicId,
        );
        if (!event)
          throw new BadRequestException(
            `Cancellation history is missing for ${invoice.invoiceNumber}; Finance must reconcile it before exporting`,
          );
        entries.push({
          at: event.createdAt,
          type: "CANCELLATION",
          reference: invoice.invoiceNumber,
          invoice: invoice.invoiceNumber,
          debit: 0n,
          credit: statementPaise(invoice.totalAmount),
        });
      }
    }
    const output = monthlyStatementCsv(entries, query.month, client);
    await tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "finance.client-statement.exported",
        resourceType: "client",
        resourcePublicId: client.publicId,
        afterJson: JSON.stringify({
          month: query.month,
          entries: output.count,
        }),
      },
    });
    return new StreamableFile(Buffer.from(output.csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="Sapling-statement-${query.month}.csv"`,
    });
  }
}

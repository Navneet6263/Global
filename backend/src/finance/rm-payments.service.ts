import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../common/auth/actor";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import {
  invoiceBalance,
  openInvoiceWhere,
  remindClientToPay,
  unbilledReportWhere,
} from "./payment-follow-up";

const MANUAL_REMINDER_GAP_MS = 12 * 3_600_000;

/**
 * RM payments: what each of the RM's companies owes, and a "send payment reminder"
 * that tells the company admins (in-app + email). Operations and the Platform Admin
 * see every company. Every reminder is audited.
 */
@Injectable()
export class RmPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly secretBox?: SecretBoxService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private clientIds(actor: Actor) {
    if (
      actor.roles.some((role) =>
        ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
      )
    )
      return undefined;
    const ids = (actor.spocClients ?? []).map((client) => client.id);
    if (!ids.length)
      throw new ForbiddenException("No companies are assigned to you yet");
    return ids;
  }

  async list(actor: Actor, now = new Date()) {
    const ids = this.clientIds(actor);
    const clients = await this.prisma.client.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(ids ? { id: { in: ids } } : {}),
        OR: [
          { invoices: { some: openInvoiceWhere } },
          { cases: { some: { reports: { some: { status: "PUBLISHED" } } } } },
        ],
      },
      orderBy: { displayName: "asc" },
      take: 200,
      select: {
        id: true,
        publicId: true,
        displayName: true,
        invoices: {
          where: openInvoiceWhere,
          orderBy: { dueAt: "asc" },
          select: {
            publicId: true,
            invoiceNumber: true,
            status: true,
            dueAt: true,
            totalAmount: true,
            paidAmount: true,
            creditedAmount: true,
            annexureStatus: true,
          },
        },
      },
    });
    const items = await Promise.all(
      clients.map(async (client) => {
        const [unbilled, lastReminder] = await Promise.all([
          this.prisma.report.count({ where: unbilledReportWhere(client.id) }),
          this.prisma.auditEvent.findFirst({
            where: {
              tenantId: actor.tenantId,
              action: {
                in: [
                  "billing.payment-reminder",
                  "billing.payment-auto-reminder",
                ],
              },
              OR: [
                { resourcePublicId: client.publicId },
                {
                  resourcePublicId: {
                    in: client.invoices.map((invoice) => invoice.publicId),
                  },
                },
              ],
            },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);
        const invoices = client.invoices
          .map((invoice) => ({
            id: invoice.publicId,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            dueAt: invoice.dueAt,
            balance: invoiceBalance(invoice),
            overdue: Boolean(invoice.dueAt && invoice.dueAt < now),
            billValidation: invoice.annexureStatus,
          }))
          .filter((invoice) => invoice.balance > 0);
        return {
          clientId: client.publicId,
          clientName: client.displayName,
          outstanding: invoices.reduce(
            (sum, invoice) => sum + invoice.balance,
            0,
          ),
          overdue: invoices
            .filter((invoice) => invoice.overdue)
            .reduce((sum, invoice) => sum + invoice.balance, 0),
          unbilledReports: unbilled,
          lastReminderAt: lastReminder?.createdAt ?? null,
          invoices,
        };
      }),
    );
    const visible = items.filter(
      (item) => item.outstanding > 0 || item.unbilledReports > 0,
    );
    return {
      items: visible,
      totals: {
        outstanding: visible.reduce((sum, item) => sum + item.outstanding, 0),
        overdue: visible.reduce((sum, item) => sum + item.overdue, 0),
        unbilledReports: visible.reduce(
          (sum, item) => sum + item.unbilledReports,
          0,
        ),
      },
    };
  }

  async remind(
    actor: Actor,
    clientPublicId: string,
    note?: string,
    now = new Date(),
  ) {
    const ids = this.clientIds(actor);
    const client = await this.prisma.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: clientPublicId,
        ...(ids ? { id: { in: ids } } : {}),
      },
      select: {
        id: true,
        publicId: true,
        invoices: {
          where: openInvoiceWhere,
          select: {
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            creditedAmount: true,
          },
        },
      },
    });
    if (!client) throw new NotFoundException("Company not found");
    const due = client.invoices.filter(
      (invoice) => invoiceBalance(invoice) > 0,
    );
    if (!due.length)
      throw new ConflictException("This company has nothing to pay right now");
    const recent = await this.prisma.auditEvent.findFirst({
      where: {
        tenantId: actor.tenantId,
        action: "billing.payment-reminder",
        resourcePublicId: client.publicId,
        createdAt: { gte: new Date(now.getTime() - MANUAL_REMINDER_GAP_MS) },
      },
      select: { id: true },
    });
    if (recent)
      throw new ConflictException(
        "A reminder already went out in the last 12 hours",
      );
    const outstanding = due.reduce(
      (sum, invoice) => sum + invoiceBalance(invoice),
      0,
    );
    const cleanNote = note?.trim().slice(0, 300) || undefined;
    return this.prisma.$transaction(async (tx) => {
      const clientAdmins = await remindClientToPay(
        tx,
        {
          secretBox: this.secretBox,
          webOrigin: this.config?.get<string>("WEB_ORIGIN"),
        },
        {
          tenantId: actor.tenantId,
          clientId: client.id,
          clientPublicId: client.publicId,
          outstanding,
          invoices: due.map((invoice) => invoice.invoiceNumber),
          note: cleanNote,
        },
      );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "billing.payment-reminder",
          resourceType: "client",
          resourcePublicId: client.publicId,
          afterJson: JSON.stringify({
            outstanding,
            invoices: due.map((invoice) => invoice.invoiceNumber),
            clientAdmins,
            note: cleanNote ?? null,
          }),
        },
      });
      return { clientId: client.publicId, outstanding, clientAdmins };
    });
  }
}

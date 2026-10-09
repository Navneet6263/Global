import { roleIs } from "../common/auth/role-filter";
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import {
  clientRmIds,
  invoiceBalance,
  notifyUsers,
  openInvoiceWhere,
  previousIstMonth,
  remindClientToPay,
  unbilledReportWhere,
} from "./payment-follow-up";

export const AUTO_REMINDER_EVERY_MS = 3 * 86_400_000;
export const MAX_AUTO_REMINDERS = 10;

/**
 * Monthly billing (reports are released after QC; money is collected monthly):
 * - once the month closes, each company's RM and Finance are told what to bill and
 *   what is outstanding, so the RM can ask the company to pay;
 * - an invoice past its due date reminds the company admins and the RM every 3 days
 *   (at most 10 times). Every notice is audited, which also spaces them out.
 */
@Injectable()
export class MonthlyBillingService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MonthlyBillingService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly secretBox?: SecretBoxService,
  ) {}

  onApplicationBootstrap() {
    if (
      !this.config.get<boolean>("OUTBOX_WORKER_ENABLED", true) ||
      !["all", "worker"].includes(
        this.config.get<string>("PROCESS_ROLE", "all"),
      )
    )
      return;
    this.timer = setInterval(() => void this.run(), 60 * 60_000);
    this.timer.unref();
    void this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    if (this.running) return { monthClosed: 0, reminders: 0 };
    this.running = true;
    try {
      return {
        monthClosed: await this.closeMonth(now),
        reminders: await this.remindOverdue(now),
      };
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Monthly billing run failed",
      );
      return { monthClosed: 0, reminders: 0 };
    } finally {
      this.running = false;
    }
  }

  /** One month-close notice per company per month (to its RM(s) and Finance). */
  async closeMonth(now = new Date()) {
    const { period, from, to } = previousIstMonth(now);
    const clients = await this.prisma.client.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          {
            cases: {
              some: {
                reports: {
                  some: {
                    status: "PUBLISHED",
                    releasedAt: { gte: from, lt: to },
                  },
                },
              },
            },
          },
          { invoices: { some: openInvoiceWhere } },
        ],
      },
      take: 500,
      select: { id: true, publicId: true, tenantId: true, displayName: true },
    });
    let sent = 0;
    for (const client of clients) {
      const key = `${client.publicId}:${period}`;
      const done = await this.prisma.$transaction(async (tx) => {
        const already = await tx.auditEvent.count({
          where: {
            tenantId: client.tenantId,
            action: "billing.month-closed",
            resourcePublicId: key,
          },
        });
        if (already) return false;
        const [unbilled, invoices] = await Promise.all([
          tx.report.count({ where: unbilledReportWhere(client.id) }),
          tx.invoice.findMany({
            where: { clientId: client.id, ...openInvoiceWhere },
            select: {
              totalAmount: true,
              paidAmount: true,
              creditedAmount: true,
            },
          }),
        ]);
        const outstanding = invoices.reduce(
          (sum, invoice) => sum + invoiceBalance(invoice),
          0,
        );
        if (!unbilled && !outstanding) return false;
        const amount = outstanding.toLocaleString("en-IN", {
          style: "currency",
          currency: "INR",
        });
        const summary = `${client.displayName}, ${period}: ${unbilled} released ${unbilled === 1 ? "report" : "reports"} to bill, ${amount} outstanding.`;
        const rms = await clientRmIds(tx, client.id);
        const finance = await tx.user.findMany({
          where: {
            tenantId: client.tenantId,
            status: "ACTIVE",
            userRoles: { some: { role: roleIs("FINANCE_MANAGER") } },
          },
          select: { id: true },
        });
        await notifyUsers(tx, client.tenantId, rms, {
          type: "BILLING_MONTH_CLOSED",
          title: `Month closed: ask ${client.displayName} to pay`,
          body: `${summary} Send the payment reminder from Payments.`,
          href: "/spoc-rm/payments",
        });
        await notifyUsers(
          tx,
          client.tenantId,
          finance.map((user) => user.id),
          {
            type: "BILLING_MONTH_CLOSED",
            title: `Month closed: bill ${client.displayName}`,
            body: `${summary} Raise the monthly invoice and send its annexure.`,
            href: "/finance/billing",
          },
        );
        await tx.auditEvent.create({
          data: {
            tenantId: client.tenantId,
            action: "billing.month-closed",
            resourceType: "client",
            resourcePublicId: key,
            afterJson: JSON.stringify({
              clientId: client.publicId,
              period,
              unbilledReports: unbilled,
              outstanding,
              rms: rms.length,
              financeUsers: finance.length,
            }),
          },
        });
        return true;
      });
      if (done) sent += 1;
    }
    return sent;
  }

  /** Overdue invoices: company admins and the RM, every 3 days, at most 10 times. */
  async remindOverdue(now = new Date()) {
    const overdue = await this.prisma.invoice.findMany({
      where: { ...openInvoiceWhere, dueAt: { lt: now } },
      take: 300,
      select: {
        id: true,
        publicId: true,
        tenantId: true,
        clientId: true,
        invoiceNumber: true,
        totalAmount: true,
        paidAmount: true,
        creditedAmount: true,
        client: { select: { publicId: true, displayName: true } },
      },
    });
    const webOrigin = this.config.get<string>("WEB_ORIGIN");
    let sent = 0;
    for (const invoice of overdue) {
      const balance = invoiceBalance(invoice);
      if (!balance) continue;
      const done = await this.prisma.$transaction(async (tx) => {
        const previous = await tx.auditEvent.findMany({
          where: {
            tenantId: invoice.tenantId,
            action: "billing.payment-auto-reminder",
            resourcePublicId: invoice.publicId,
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        if (
          previous.length >= MAX_AUTO_REMINDERS ||
          (previous[0] &&
            now.getTime() - previous[0].createdAt.getTime() <
              AUTO_REMINDER_EVERY_MS)
        )
          return false;
        const clientAdmins = await remindClientToPay(
          tx,
          { secretBox: this.secretBox, webOrigin },
          {
            tenantId: invoice.tenantId,
            clientId: invoice.clientId,
            clientPublicId: invoice.client.publicId,
            outstanding: balance,
            invoices: [invoice.invoiceNumber],
            note: "This invoice is past its due date.",
          },
        );
        const rms = await clientRmIds(tx, invoice.clientId);
        await notifyUsers(tx, invoice.tenantId, rms, {
          type: "PAYMENT_OVERDUE",
          title: `${invoice.client.displayName}: ${invoice.invoiceNumber} overdue`,
          body: `${balance.toLocaleString("en-IN", { style: "currency", currency: "INR" })} still unpaid. The company has been reminded; follow up with them.`,
          href: "/spoc-rm/payments",
        });
        await tx.auditEvent.create({
          data: {
            tenantId: invoice.tenantId,
            action: "billing.payment-auto-reminder",
            resourceType: "invoice",
            resourcePublicId: invoice.publicId,
            afterJson: JSON.stringify({
              invoiceNumber: invoice.invoiceNumber,
              balance,
              reminder: previous.length + 1,
              clientAdmins,
              rms: rms.length,
            }),
          },
        });
        return true;
      });
      if (done) sent += 1;
    }
    return sent;
  }
}

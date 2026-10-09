import { queueEmail } from "../common/mail/queue-email";
import type { SecretBoxService } from "../common/security/secret-box.service";
import type { Prisma } from "../generated/prisma/client";
import { settledInvoiceStatuses } from "./finance.shared";

/** Invoices that still have money to collect. */
export const openInvoiceWhere = {
  status: { notIn: [...settledInvoiceStatuses, "DRAFT"] },
} satisfies Prisma.InvoiceWhereInput;

export const invoiceBalance = (invoice: {
  totalAmount: unknown;
  paidAmount: unknown;
  creditedAmount: unknown;
}) =>
  Math.max(
    0,
    Number(invoice.totalAmount) -
      Number(invoice.paidAmount) -
      Number(invoice.creditedAmount),
  );

/** Released reports (monthly billing) that are not on any live invoice yet. */
export const unbilledReportWhere = (clientId: bigint) =>
  ({
    workflowVersion: 2,
    status: "PUBLISHED",
    case: { clientId, status: { in: ["COMPLETED", "CLOSED"] } },
    invoiceLines: { none: { invoice: { status: { not: "CANCELLED" } } } },
  }) satisfies Prisma.ReportWhereInput;

/** The company's RM(s): the primary RM plus every SPOC-RM mapped to the company. */
export async function clientRmIds(
  tx: Pick<Prisma.TransactionClient, "client" | "spocClientScope">,
  clientId: bigint,
) {
  const [client, scopes] = await Promise.all([
    tx.client.findUnique({
      where: { id: clientId },
      select: { primaryRmUserId: true },
    }),
    tx.spocClientScope.findMany({
      where: { clientId, user: { status: "ACTIVE" } },
      select: { userId: true },
    }),
  ]);
  return [
    ...new Set([
      ...(client?.primaryRmUserId ? [client.primaryRmUserId] : []),
      ...scopes.map((scope) => scope.userId),
    ]),
  ];
}

/**
 * Payment reminder to the company admins (in-app + email). `from` names who asked,
 * e.g. the RM, or "automatic" for the scheduled reminder.
 */
export async function remindClientToPay(
  tx: Prisma.TransactionClient,
  deps: { secretBox?: SecretBoxService; webOrigin?: string },
  input: {
    tenantId: bigint;
    clientId: bigint;
    clientPublicId: string;
    outstanding: number;
    invoices: string[];
    note?: string;
  },
) {
  const admins = await tx.user.findMany({
    where: {
      tenantId: input.tenantId,
      clientId: input.clientId,
      status: "ACTIVE",
      userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
    },
    select: { id: true, email: true },
  });
  const amount = input.outstanding.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
  const message = `${amount} is due on ${input.invoices.join(", ")}.${input.note ? ` ${input.note}` : ""} Please arrange payment; you can see every invoice under Invoices & payments.`;
  if (admins.length)
    await tx.notification.createMany({
      data: admins.map((admin) => ({
        tenantId: input.tenantId,
        userId: admin.id,
        type: "PAYMENT_REMINDER",
        title: `Payment due: ${amount}`,
        body: message.slice(0, 1000),
        href: "/client-portal/billing",
      })),
    });
  if (deps.secretBox && deps.webOrigin)
    for (const admin of admins)
      await queueEmail(tx, deps.secretBox, {
        tenantId: input.tenantId,
        aggregateType: "client",
        aggregateId: input.clientPublicId,
        to: admin.email,
        template: "onboarding-update",
        variables: {
          message,
          url: `${deps.webOrigin}/client-portal/billing`,
        },
      });
  return admins.length;
}

export async function notifyUsers(
  tx: Pick<Prisma.TransactionClient, "notification">,
  tenantId: bigint,
  userIds: bigint[],
  notice: { type: string; title: string; body: string; href: string },
) {
  if (!userIds.length) return 0;
  await tx.notification.createMany({
    data: userIds.map((userId) => ({
      tenantId,
      userId,
      ...notice,
      body: notice.body.slice(0, 1000),
    })),
  });
  return userIds.length;
}

/** "2026-09" for the IST month before `now`, plus the IST start of the current month. */
export function previousIstMonth(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const thisMonth = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 330 * 60_000,
  );
  const previous = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1),
  );
  const period = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    period,
    from: new Date(previous.getTime() - 330 * 60_000),
    to: thisMonth,
  };
}

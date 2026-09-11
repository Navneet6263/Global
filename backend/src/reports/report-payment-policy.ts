import { toPaise } from "../finance/finance.shared";

type LinkedInvoice = {
  status: string;
  totalAmount: unknown;
  paidAmount: unknown;
  creditedAmount: unknown;
};

export function reportPaymentReady(invoices: LinkedInvoice[]): boolean {
  const active = invoices.filter((invoice) => invoice.status !== "CANCELLED");
  return (
    active.length > 0 &&
    active.every(
      (invoice) =>
        invoice.status === "PAID" &&
        toPaise(invoice.totalAmount) > 0 &&
        toPaise(invoice.paidAmount) === toPaise(invoice.totalAmount) &&
        toPaise(invoice.creditedAmount) === 0,
    )
  );
}

export function canReadReleasedReport(
  report: {
    status: string;
    workflowVersion: number;
    releasedAt: Date | null;
    downloadExpiresAt: Date | null;
  },
  now = new Date(),
): boolean {
  if (report.status !== "PUBLISHED") return false;
  if (report.workflowVersion === 1) return true;
  return (
    report.workflowVersion === 2 &&
    Boolean(report.releasedAt) &&
    Boolean(report.downloadExpiresAt && report.downloadExpiresAt > now)
  );
}

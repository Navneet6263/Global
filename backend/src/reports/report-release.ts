import { ConflictException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { caseEvidenceReadiness } from "../documents/evidence-readiness";
import { reportPaymentReady } from "./report-payment-policy";
import { reportDownloadExpiry } from "./report-access-policy";

export async function releasePreparedReport(
  tx: Prisma.TransactionClient,
  tenantId: bigint,
  reportPublicId: string,
  actorUserId?: bigint,
): Promise<boolean> {
  const report = await tx.report.findFirst({
    where: { tenantId, publicId: reportPublicId, workflowVersion: 2 },
    select: {
      id: true,
      status: true,
      currentVersion: true,
      releasedAt: true,
      managerReviewId: true,
      managerReview: { select: { decision: true, caseId: true } },
      case: {
        select: {
          id: true,
          publicId: true,
          status: true,
          version: true,
          clientId: true,
        },
      },
      invoiceLines: {
        select: {
          invoice: {
            select: {
              id: true,
              tenantId: true,
              clientId: true,
              status: true,
              totalAmount: true,
              paidAmount: true,
              creditedAmount: true,
            },
          },
        },
      },
    },
  });
  if (!report) return false;
  if (report.status === "PUBLISHED") {
    return Boolean(
      report.releasedAt &&
      report.currentVersion > 0 &&
      report.managerReview?.decision === "APPROVED" &&
      report.managerReview.caseId === report.case.id &&
      ["COMPLETED", "CLOSED"].includes(report.case.status),
    );
  }
  if (
    report.status !== "PREPARED" ||
    report.currentVersion < 1 ||
    report.managerReview?.decision !== "APPROVED" ||
    report.managerReview.caseId !== report.case.id ||
    report.case.status !== "PAYMENT_PENDING"
  )
    return false;
  const invoices = [
    ...new Map(
      report.invoiceLines.map((line) => [line.invoice.id, line.invoice]),
    ).values(),
  ];
  if (
    invoices.some(
      (invoice) =>
        invoice.tenantId !== tenantId ||
        invoice.clientId !== report.case.clientId,
    ) ||
    !reportPaymentReady(invoices)
  )
    return false;
  if (!(await caseEvidenceReadiness(tx, report.case.id)).ready) return false;
  const now = new Date();
  const changed = await tx.report.updateMany({
    where: {
      id: report.id,
      status: "PREPARED",
      currentVersion: report.currentVersion,
      managerReviewId: report.managerReviewId,
    },
    data: {
      status: "PUBLISHED",
      publishedAt: now,
      releasedAt: now,
      releasedById: actorUserId,
      downloadExpiresAt: reportDownloadExpiry(now),
    },
  });
  if (changed.count !== 1)
    throw new ConflictException("Report release changed concurrently");
  const completed = await tx.verificationCase.updateMany({
    where: {
      id: report.case.id,
      status: "PAYMENT_PENDING",
      version: report.case.version,
    },
    data: { status: "COMPLETED", completedAt: now, version: { increment: 1 } },
  });
  if (completed.count !== 1)
    throw new ConflictException("Case changed during report release");
  await tx.caseStatusHistory.create({
    data: {
      caseId: report.case.id,
      fromStatus: "PAYMENT_PENDING",
      toStatus: "COMPLETED",
      changedById: actorUserId,
      reason: "Manager-approved report released after successful full payment",
    },
  });
  await tx.auditEvent.create({
    data: {
      tenantId,
      actorUserId,
      action: "report.released",
      resourceType: "report",
      resourcePublicId: reportPublicId,
      afterJson: JSON.stringify({
        caseId: report.case.publicId,
        reportVersion: report.currentVersion,
        invoiceIds: invoices.map((invoice) => invoice.id.toString()),
        releasedAt: now,
      }),
    },
  });
  const recipients = await tx.user.findMany({
    where: {
      tenantId,
      clientId: report.case.clientId,
      status: "ACTIVE",
      userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
    },
    select: { id: true },
  });
  if (recipients.length)
    await tx.notification.createMany({
      data: recipients.map((user) => ({
        tenantId,
        userId: user.id,
        type: "REPORT_RELEASED",
        title: "Verification report available",
        body: "Your approved verification report is ready to download.",
        href: "/client-portal/reports",
      })),
    });
  return true;
}

export async function releaseInvoiceReports(
  tx: Prisma.TransactionClient,
  tenantId: bigint,
  invoiceId: bigint,
  actorUserId: bigint,
) {
  const lines = await tx.invoiceLine.findMany({
    where: { invoiceId, reportId: { not: null } },
    select: { report: { select: { publicId: true } } },
  });
  for (const publicId of new Set(
    lines.flatMap((line) => (line.report ? [line.report.publicId] : [])),
  )) {
    await releasePreparedReport(tx, tenantId, publicId, actorUserId);
  }
}

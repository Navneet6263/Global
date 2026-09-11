import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { assertReportInvoiceCharges } from "./report-invoice-policy";

type BillingLine = {
  caseId?: bigint;
  reportPublicId?: string;
  baseCents: number;
  taxCents: number;
};

export async function allocateInvoiceReports(
  tx: Prisma.TransactionClient,
  tenantId: bigint,
  clientId: bigint,
  lines: BillingLine[],
): Promise<Array<bigint | undefined>> {
  const resolved: Array<bigint | undefined> = [];
  const locked = new Set<bigint>();
  const charges = new Map<
    bigint,
    Array<{ unitPrice: unknown; taxRate: unknown }>
  >();
  for (const line of lines) {
    if (line.reportPublicId && !line.caseId) {
      throw new BadRequestException(
        "A report invoice line must identify its case",
      );
    }
    if (!line.caseId) {
      resolved.push(undefined);
      continue;
    }
    const report = await tx.report.findFirst({
      where: {
        tenantId,
        caseId: line.caseId,
        ...(line.reportPublicId ? { publicId: line.reportPublicId } : {}),
        workflowVersion: 2,
        status: "PREPARED",
        case: { clientId, status: "PAYMENT_PENDING" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        currentVersion: true,
        case: {
          select: { services: { select: { unitPrice: true, taxRate: true } } },
        },
      },
    });
    if (!report) {
      const legacyPublished = await tx.verificationCase.count({
        where: {
          id: line.caseId,
          tenantId,
          reports: { some: { workflowVersion: 1, status: "PUBLISHED" } },
        },
      });
      if (line.reportPublicId || !legacyPublished) {
        throw new NotFoundException(
          "The selected case has no approved report ready for billing",
        );
      }
      resolved.push(undefined);
      continue;
    }
    if (!locked.has(report.id)) {
      // Serialize invoice allocation against payment release and another invoice.
      const claimed = await tx.report.updateMany({
        where: {
          id: report.id,
          status: "PREPARED",
          currentVersion: report.currentVersion,
        },
        data: { status: "PREPARED" },
      });
      if (claimed.count !== 1)
        throw new ConflictException("Report billing state changed");
      const alreadyBilled = await tx.invoiceLine.count({
        where: {
          reportId: report.id,
          invoice: { status: { not: "CANCELLED" } },
        },
      });
      if (alreadyBilled)
        throw new ConflictException(
          "This report is already allocated to an invoice",
        );
      locked.add(report.id);
      charges.set(report.id, report.case.services);
    }
    resolved.push(report.id);
  }
  for (const [reportId, services] of charges) {
    assertReportInvoiceCharges(
      lines.filter((_, index) => resolved[index] === reportId),
      services,
    );
  }
  return resolved;
}

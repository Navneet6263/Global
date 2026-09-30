import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { VendorTx } from "./vendor-assignments.repository";

const name = { select: { displayName: true } } as const;

/** Latest report of an assignment, as both sides see it (no object key). */
export const latestReportSelect = {
  orderBy: { version: "desc" },
  take: 1,
  select: {
    publicId: true,
    version: true,
    originalName: true,
    contentType: true,
    sizeBytes: true,
    createdAt: true,
    uploadedBy: name,
  },
} as const;

/** Data access for vendor reports. Callers pass an already-scoped assignment where. */
@Injectable()
export class VendorReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: VendorTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  /** The request a vendor login wants to attach a report to. */
  findForUpload(where: Prisma.VendorAssignmentWhereInput) {
    return this.prisma.vendorAssignment.findFirst({
      where,
      select: {
        id: true,
        publicId: true,
        status: true,
        clientId: true,
        assignedById: true,
        case: { select: { caseNumber: true } },
        document: { select: { type: true } },
        client: { select: { publicId: true, displayName: true } },
        vendor: name,
      },
    });
  }

  /** Row lock and re-check: the request must still be APPROVED while we write. */
  lockApproved(tx: VendorTx, assignmentId: bigint) {
    return tx.vendorAssignment.updateMany({
      where: { id: assignmentId, status: "APPROVED" },
      data: { updatedAt: new Date() },
    });
  }

  latestVersion(tx: VendorTx, assignmentId: bigint) {
    return tx.vendorReport.findFirst({
      where: { assignmentId },
      orderBy: { version: "desc" },
      select: { version: true, sha256: true },
    });
  }

  create(tx: VendorTx, data: Prisma.VendorReportUncheckedCreateInput) {
    return tx.vendorReport.create({ data, select: latestReportSelect.select });
  }

  /** The latest report file of one scoped, APPROVED assignment (for streaming). */
  findReportFile(where: Prisma.VendorAssignmentWhereInput) {
    return this.prisma.vendorAssignment.findFirst({
      where: { ...where, status: "APPROVED" },
      select: {
        publicId: true,
        case: { select: { caseNumber: true } },
        reports: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            publicId: true,
            version: true,
            objectKey: true,
            contentType: true,
          },
        },
      },
    });
  }

  isReferenced(objectKey: string) {
    return this.prisma.vendorReport.count({ where: { objectKey } });
  }

  queueObjectDelete(
    tenantId: bigint,
    assignmentPublicId: string,
    objectKey: string,
  ) {
    return this.prisma.outboxEvent.create({
      data: {
        tenantId,
        topic: "object.delete.requested",
        aggregateType: "vendor_assignment",
        aggregateId: assignmentPublicId,
        payloadJson: JSON.stringify({ objectKey }),
      },
    });
  }

  recordAudit(tx: VendorTx, data: Prisma.AuditEventUncheckedCreateInput) {
    return tx.auditEvent.create({ data });
  }

  /** Audit outside a transaction (a file stream is only served after this succeeds). */
  audit(data: Prisma.AuditEventUncheckedCreateInput) {
    return this.prisma.auditEvent.create({ data });
  }
}

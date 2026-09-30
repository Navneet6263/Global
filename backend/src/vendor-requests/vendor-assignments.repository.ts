import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";

export type VendorTx = Prisma.TransactionClient;

const caseSelect = {
  select: {
    id: true,
    publicId: true,
    caseNumber: true,
    status: true,
    clientId: true,
    client: { select: { displayName: true } },
  },
} as const;

const cleanVersion = {
  where: { malwareState: "CLEAN" },
  orderBy: { version: "desc" },
  take: 1,
  select: { version: true },
} as const;

const chain = { select: { attempt: true, status: true } } as const;

const assignmentResult = {
  publicId: true,
  attempt: true,
  status: true,
  version: true,
  documentVersion: true,
  createdAt: true,
} as const;

/**
 * Data access for the SPOC-RM vendor writes: assign, re-assign and re-upload. Every
 * lookup takes the caller's scoped where; services own the rules.
 */
@Injectable()
export class VendorAssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Serializable, so two SPOC-RMs racing on one document cannot both win. */
  serializable<T>(work: (tx: VendorTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work, { isolationLevel: "Serializable" });
  }

  /**
   * An ACTIVE Main Vendor (VENDOR role, not a team user) in the tenant; re-checked
   * inside each write, so a team user can never be assigned directly.
   */
  findActiveVendor(tx: VendorTx, tenantId: bigint, vendorPublicId: string) {
    return tx.user.findFirst({
      where: {
        tenantId,
        publicId: vendorPublicId,
        status: "ACTIVE",
        vendorOwnerId: null,
        userRoles: { some: { role: { code: "VENDOR" } } },
      },
      select: { id: true, publicId: true, displayName: true },
    });
  }

  findDocumentToAssign(tx: VendorTx, where: Prisma.DocumentWhereInput) {
    return tx.document.findFirst({
      where,
      select: {
        id: true,
        publicId: true,
        type: true,
        case: caseSelect,
        versions: cleanVersion,
        vendorAssignments: chain,
      },
    });
  }

  findAssignmentToReassign(
    tx: VendorTx,
    where: Prisma.VendorAssignmentWhereInput,
  ) {
    return tx.vendorAssignment.findFirst({
      where,
      select: {
        publicId: true,
        attempt: true,
        status: true,
        version: true,
        decisionReason: true,
        vendor: { select: { publicId: true, displayName: true } },
        case: caseSelect,
        document: {
          select: {
            id: true,
            publicId: true,
            type: true,
            status: true,
            versions: cleanVersion,
            vendorAssignments: chain,
          },
        },
      },
    });
  }

  createAssignment(
    tx: VendorTx,
    data: Prisma.VendorAssignmentUncheckedCreateInput,
  ) {
    return tx.vendorAssignment.create({ data, select: assignmentResult });
  }

  findDocumentForReupload(tx: VendorTx, where: Prisma.DocumentWhereInput) {
    return tx.document.findFirst({
      where,
      select: {
        id: true,
        publicId: true,
        type: true,
        status: true,
        version: true,
        currentVersion: true,
        case: {
          select: {
            id: true,
            publicId: true,
            caseNumber: true,
            status: true,
            branchId: true,
            clientId: true,
            assignedOpsUserId: true,
            subject: {
              select: {
                email: true,
                phone: true,
                employeeCode: true,
                piiCiphertext: true,
                piiKeyVersion: true,
              },
            },
          },
        },
        vendorAssignments: {
          select: { publicId: true, attempt: true, status: true },
        },
      },
    });
  }

  /** Optimistic: only the Document.version the SPOC-RM was looking at is updated. */
  markReuploadRequested(
    tx: VendorTx,
    target: { id: bigint; version: number },
    data: {
      status: string;
      reviewNote: string;
      reviewedById: bigint;
      reviewedAt: Date;
    },
  ) {
    return tx.document.updateMany({
      where: { id: target.id, version: target.version },
      data: { ...data, version: { increment: 1 } },
    });
  }

  activeCandidateLink(
    tx: VendorTx,
    tenantId: bigint,
    caseId: bigint,
    now: Date,
  ) {
    return tx.candidatePortalAccess.findFirst({
      where: { tenantId, caseId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
      select: { expiresAt: true },
    });
  }

  queueOutbox(tx: VendorTx, data: Prisma.OutboxEventUncheckedCreateInput) {
    return tx.outboxEvent.create({ data });
  }

  recordAudit(tx: VendorTx, data: Prisma.AuditEventUncheckedCreateInput) {
    return tx.auditEvent.create({ data });
  }
}

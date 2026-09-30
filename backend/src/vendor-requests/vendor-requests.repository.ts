import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { paging } from "../spoc/spoc-scope";
import type { VendorTx } from "./vendor-assignments.repository";
import { latestReportSelect } from "./vendor-reports.repository";

const name = { select: { displayName: true } } as const;

/**
 * An explicit allowlist for the vendor: no candidate contact details, no other
 * documents, no case stage.
 */
export const vendorListSelect = {
  publicId: true,
  attempt: true,
  status: true,
  createdAt: true,
  decidedAt: true,
  document: { select: { type: true } },
  case: { select: { caseNumber: true } },
  client: name,
  assignedBy: name,
  handler: name,
  _count: { select: { reports: true } },
} as const;

export const vendorDetailSelect = {
  publicId: true,
  attempt: true,
  status: true,
  version: true,
  documentId: true,
  documentVersion: true,
  assignmentNote: true,
  resolutionNote: true,
  decisionReason: true,
  createdAt: true,
  decidedAt: true,
  document: { select: { type: true } },
  case: {
    select: {
      caseNumber: true,
      subject: { select: { fullName: true } },
    },
  },
  client: name,
  assignedBy: name,
  handlerUserId: true,
  delegatedAt: true,
  lastRemindedAt: true,
  handler: { select: { publicId: true, displayName: true } },
  reports: latestReportSelect,
} as const;

/** Data access for the Vendor workspace. Every where is keyed on the caller's own requests. */
@Injectable()
export class VendorRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: VendorTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  async pageOwn(
    own: Prisma.VendorAssignmentWhereInput,
    where: Prisma.VendorAssignmentWhereInput,
    page: number,
    pageSize: number,
  ) {
    const [rows, total, counts] = await Promise.all([
      this.prisma.vendorAssignment.findMany({
        where,
        select: vendorListSelect,
        orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
        ...paging(page, pageSize),
      }),
      this.prisma.vendorAssignment.count({ where }),
      this.prisma.vendorAssignment.groupBy({
        by: ["status"],
        where: own,
        _count: { _all: true },
      }),
    ]);
    return { rows, total, counts };
  }

  findOwn(where: Prisma.VendorAssignmentWhereInput) {
    return this.prisma.vendorAssignment.findFirst({
      where,
      select: vendorDetailSelect,
    });
  }

  /** Exactly the version that was assigned, never a later upload. */
  assignedFile(documentId: bigint, version: number) {
    return this.prisma.documentVersion.findFirst({
      where: { documentId, version, malwareState: "CLEAN" },
      select: {
        originalName: true,
        contentType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });
  }

  findOwnForPreview(where: Prisma.VendorAssignmentWhereInput) {
    return this.prisma.vendorAssignment.findFirst({
      where,
      select: {
        documentVersion: true,
        document: { select: { publicId: true } },
      },
    });
  }

  findOwnForDecision(tx: VendorTx, where: Prisma.VendorAssignmentWhereInput) {
    return tx.vendorAssignment.findFirst({
      where,
      select: {
        id: true,
        publicId: true,
        attempt: true,
        status: true,
        version: true,
        clientId: true,
        assignedById: true,
        documentVersion: true,
        document: { select: { publicId: true, type: true } },
        case: { select: { publicId: true, caseNumber: true } },
        client: name,
        vendor: name,
      },
    });
  }

  /** A Main Vendor's own request, with what delegation and reminders need. */
  findOwnForDelegation(tx: VendorTx, where: Prisma.VendorAssignmentWhereInput) {
    return tx.vendorAssignment.findFirst({
      where,
      select: {
        id: true,
        publicId: true,
        status: true,
        version: true,
        handlerUserId: true,
        lastRemindedAt: true,
        document: { select: { type: true } },
        case: { select: { caseNumber: true } },
        client: name,
        handler: { select: { publicId: true, displayName: true } },
      },
    });
  }

  /** Optimistic: only a still-PENDING row at the version the Main Vendor read. */
  setHandler(
    tx: VendorTx,
    row: { id: bigint; version: number },
    handlerUserId: bigint | null,
  ) {
    return tx.vendorAssignment.updateMany({
      where: { id: row.id, version: row.version, status: "PENDING" },
      data: {
        handlerUserId,
        delegatedAt: handlerUserId === null ? null : new Date(),
        version: { increment: 1 },
      },
    });
  }

  markReminded(tx: VendorTx, id: bigint, at: Date) {
    return tx.vendorAssignment.update({
      where: { id },
      data: { lastRemindedAt: at },
    });
  }

  /** Only a still-PENDING row at the version the vendor read can be decided. */
  recordDecision(
    tx: VendorTx,
    where: Prisma.VendorAssignmentWhereInput,
    data: Prisma.VendorAssignmentUncheckedUpdateManyInput,
  ) {
    return tx.vendorAssignment.updateMany({
      where,
      data: { ...data, version: { increment: 1 } },
    });
  }

  recordAudit(tx: VendorTx, data: Prisma.AuditEventUncheckedCreateInput) {
    return tx.auditEvent.create({ data });
  }
}

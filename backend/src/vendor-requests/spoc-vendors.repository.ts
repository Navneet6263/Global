import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { paging } from "../spoc/spoc-scope";
import { latestReportSelect } from "./vendor-reports.repository";

const name = { select: { displayName: true } } as const;

/** Every attempt of a document's chain, oldest first: the complete assignment history. */
const attemptSelect = {
  publicId: true,
  attempt: true,
  status: true,
  version: true,
  documentVersion: true,
  assignmentNote: true,
  resolutionNote: true,
  decisionReason: true,
  createdAt: true,
  decidedAt: true,
  vendor: { select: { publicId: true, displayName: true } },
  assignedBy: name,
  decidedBy: name,
  reports: latestReportSelect,
} as const;

export const documentSelect = {
  publicId: true,
  type: true,
  status: true,
  version: true,
  currentVersion: true,
  reviewNote: true,
  reviewedAt: true,
  updatedAt: true,
  case: {
    select: {
      id: true,
      publicId: true,
      caseNumber: true,
      status: true,
      subject: { select: { fullName: true } },
      client: { select: { publicId: true, displayName: true } },
    },
  },
  versions: {
    where: { malwareState: "CLEAN" },
    orderBy: { version: "desc" },
    take: 1,
    select: {
      version: true,
      originalName: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
    },
  },
  vendorAssignments: { orderBy: { attempt: "asc" }, select: attemptSelect },
} as const;

const clientSelect = {
  id: true,
  publicId: true,
  code: true,
  displayName: true,
  status: true,
} as const;

/** Read-only data access for the SPOC-RM Vendors page. Callers pass scoped wheres. */
@Injectable()
export class SpocVendorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async pageClients(
    where: Prisma.ClientWhereInput,
    page: number,
    pageSize: number,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: clientSelect,
        orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
        ...paging(page, pageSize),
      }),
      this.prisma.client.count({ where }),
    ]);
    return { rows, total };
  }

  /** Uploaded documents and every vendor attempt of the listed clients (roll-up input). */
  clientActivity(tenantId: bigint, clientIds: bigint[]) {
    return Promise.all([
      this.prisma.document.findMany({
        where: {
          tenantId,
          currentVersion: { gt: 0 },
          case: { clientId: { in: clientIds } },
        },
        select: { case: { select: { clientId: true } } },
      }),
      this.prisma.vendorAssignment.findMany({
        where: { tenantId, clientId: { in: clientIds } },
        select: {
          clientId: true,
          documentId: true,
          attempt: true,
          status: true,
        },
      }),
    ]);
  }

  findClient(where: Prisma.ClientWhereInput) {
    return this.prisma.client.findFirst({ where, select: clientSelect });
  }

  async pageDocuments(
    where: Prisma.DocumentWhereInput,
    page: number,
    pageSize: number,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        select: documentSelect,
        orderBy: [{ updatedAt: "desc" }, { publicId: "asc" }],
        ...paging(page, pageSize),
      }),
      this.prisma.document.count({ where }),
    ]);
    return { rows, total };
  }

  findDocument(where: Prisma.DocumentWhereInput) {
    return this.prisma.document.findFirst({ where, select: documentSelect });
  }

  /** Drawer extras: candidate link, every clean version and the re-upload audit trail. */
  documentTrail(
    tenantId: bigint,
    caseId: bigint,
    documentPublicId: string,
    now: Date,
  ) {
    return Promise.all([
      this.prisma.candidatePortalAccess.findFirst({
        where: { tenantId, caseId, revokedAt: null, expiresAt: { gt: now } },
        orderBy: { expiresAt: "desc" },
        select: { expiresAt: true },
      }),
      this.prisma.documentVersion.findMany({
        where: {
          document: { tenantId, publicId: documentPublicId },
          malwareState: "CLEAN",
        },
        orderBy: { version: "asc" },
        select: { version: true, createdAt: true, uploadedById: true },
      }),
      this.prisma.auditEvent.findMany({
        where: {
          tenantId,
          resourceType: "document",
          resourcePublicId: documentPublicId,
          action: "document.reupload-requested",
        },
        orderBy: { createdAt: "asc" },
        take: 50,
        select: {
          createdAt: true,
          afterJson: true,
          actor: { select: { displayName: true } },
        },
      }),
    ]);
  }

  userNames(tenantId: bigint, ids: bigint[]) {
    return ids.length
      ? this.prisma.user.findMany({
          where: { tenantId, id: { in: ids } },
          select: { id: true, displayName: true },
        })
      : Promise.resolve([]);
  }

  activeVendors(tenantId: bigint) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        // SPOC-RM assigns only to Main Vendors; their team users work by delegation.
        vendorOwnerId: null,
        userRoles: { some: { role: { code: "VENDOR" } } },
      },
      select: {
        publicId: true,
        displayName: true,
        _count: {
          select: { vendorRequests: { where: { status: "PENDING" } } },
        },
      },
      orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
      take: 500,
    });
  }
}

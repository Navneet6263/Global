import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { paging } from "../spoc/spoc-scope";

export type SupportTx = Prisma.TransactionClient;

/** What an agent sees. No candidate contact details, files or internal user emails. */
export const supportRequestSelect = {
  publicId: true,
  requestNumber: true,
  requesterType: true,
  subject: true,
  message: true,
  status: true,
  resolutionNote: true,
  resolvedAt: true,
  version: true,
  assignedToId: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { displayName: true } },
  assignedTo: { select: { publicId: true, displayName: true } },
  client: { select: { publicId: true, displayName: true } },
  case: {
    select: {
      publicId: true,
      caseNumber: true,
      status: true,
      subject: { select: { fullName: true } },
    },
  },
} as const;

/** What a requester sees about their own requests: status and the agent's reply. */
export const requesterSelect = {
  publicId: true,
  requestNumber: true,
  subject: true,
  status: true,
  resolutionNote: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  case: { select: { caseNumber: true } },
} as const;

export type SupportRequestRow = Prisma.SupportRequestGetPayload<{
  select: typeof supportRequestSelect;
}>;
export type RequesterRow = Prisma.SupportRequestGetPayload<{
  select: typeof requesterSelect;
}>;

const newestFirst = [
  { createdAt: "desc" as const },
  { publicId: "asc" as const },
];

/** Data access for support requests. Services own the rules; this owns the queries. */
@Injectable()
export class SupportRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: SupportTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  findClient(tenantId: bigint, clientId: bigint) {
    return this.prisma.client.findFirst({
      where: { tenantId, id: clientId },
      select: { id: true, displayName: true },
    });
  }

  /** A case by number inside the caller's own case scope (never a raw id). */
  findCaseByNumber(
    scope: Prisma.VerificationCaseWhereInput,
    caseNumber: string,
  ) {
    return this.prisma.verificationCase.findFirst({
      where: { ...scope, caseNumber },
      select: { id: true },
    });
  }

  findUserName(tenantId: bigint, userId: bigint) {
    return this.prisma.user.findFirst({
      where: { tenantId, id: userId },
      select: { displayName: true },
    });
  }

  countOpen(tx: SupportTx, where: Prisma.SupportRequestWhereInput) {
    return tx.supportRequest.count({
      where: { ...where, status: { not: "RESOLVED" } },
    });
  }

  create(tx: SupportTx, data: Prisma.SupportRequestUncheckedCreateInput) {
    return tx.supportRequest.create({ data, select: requesterSelect });
  }

  async pageForRequester(
    where: Prisma.SupportRequestWhereInput,
    page: number,
    pageSize: number,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.supportRequest.findMany({
        where,
        select: requesterSelect,
        orderBy: newestFirst,
        ...paging(page, pageSize),
      }),
      this.prisma.supportRequest.count({ where }),
    ]);
    return { rows, total };
  }

  latestForCase(tenantId: bigint, caseId: bigint, requesterType?: string) {
    return this.prisma.supportRequest.findMany({
      where: { tenantId, caseId, ...(requesterType ? { requesterType } : {}) },
      select: requesterSelect,
      orderBy: newestFirst,
      take: 20,
    });
  }

  async pageForAgent(
    where: Prisma.SupportRequestWhereInput,
    page: number,
    pageSize: number,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.supportRequest.findMany({
        where,
        select: supportRequestSelect,
        orderBy: newestFirst,
        ...paging(page, pageSize),
      }),
      this.prisma.supportRequest.count({ where }),
    ]);
    return { rows, total };
  }

  findForAgent(where: Prisma.SupportRequestWhereInput) {
    return this.prisma.supportRequest.findFirst({
      where,
      select: supportRequestSelect,
    });
  }

  /** Requests linked to one employee case, shown in the agent's employee drawer. */
  forCase(tenantId: bigint, caseId: bigint) {
    return this.prisma.supportRequest.findMany({
      where: { tenantId, caseId },
      select: supportRequestSelect,
      orderBy: newestFirst,
      take: 20,
    });
  }

  findForUpdate(tx: SupportTx, where: Prisma.SupportRequestWhereInput) {
    return tx.supportRequest.findFirst({
      where,
      select: {
        id: true,
        status: true,
        version: true,
        requestNumber: true,
        requesterType: true,
        requesterUserId: true,
        assignedToId: true,
      },
    });
  }

  /** Optimistic write: matches only the version and status the caller read. */
  updateStatus(
    tx: SupportTx,
    current: { id: bigint; version: number; status: string },
    data: Prisma.SupportRequestUncheckedUpdateManyInput,
  ) {
    return tx.supportRequest.updateMany({
      where: {
        id: current.id,
        version: current.version,
        status: current.status,
      },
      data: { ...data, version: { increment: 1 } },
    });
  }

  recordAudit(tx: SupportTx, data: Prisma.AuditEventUncheckedCreateInput) {
    return tx.auditEvent.create({ data });
  }
}

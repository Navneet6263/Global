import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";

import { PrismaService } from "../database/prisma.service";
import type {
  SpocInvoiceQueryDto,
  SpocOpportunityQueryDto,
  SpocTaskQueryDto,
  SpocVisitQueryDto,
} from "./dto/spoc-query.dto";
import { activeTaskStatuses, settledInvoiceStatuses } from "./spoc-holder";
import { bucketContext } from "./spoc-case-records.service";
import {
  invoiceBucket,
  opportunityBucket,
  taskBucket,
  visitBucket,
} from "./spoc-buckets";
import {
  pageResult,
  paging,
  resolveSpocClients,
  spocCaseWhere,
} from "./spoc-scope";

function withBucket(where: object, bucket: object | null) {
  return bucket ? { AND: [where, bucket] } : where;
}

function endOfToday(now: Date) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

@Injectable()
export class SpocWorkRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async tasks(actor: Actor, query: SpocTaskQueryDto) {
    const now = new Date();
    const text = query.search?.trim();
    const base = {
      tenantId: actor.tenantId,
      check: {
        case: spocCaseWhere(actor, query),
        ...(text
          ? {
              OR: [
                { type: { contains: text } },
                { case: { caseNumber: { contains: text } } },
                { case: { subject: { fullName: { contains: text } } } },
              ],
            }
          : {}),
      },
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId ? { assignee: { publicId: query.assigneeId } } : {}),
      ...(query.sla === "overdue"
        ? { status: { in: activeTaskStatuses }, dueAt: { lt: now } }
        : {}),
      ...(query.sla === "dueToday"
        ? {
            status: { in: activeTaskStatuses },
            dueAt: { gte: now, lte: endOfToday(now) },
          }
        : {}),
    };
    const ctx = bucketContext(actor, query, new Date());
    const where = withBucket(
      base,
      query.bucket ? taskBucket(query.bucket, ctx) : null,
    );
    const [rows, total] = await Promise.all([
      this.prisma.checkTask.findMany({
        where,
        select: {
          publicId: true,
          status: true,
          dueAt: true,
          completedAt: true,
          blockerReason: true,
          createdAt: true,
          assignee: { select: { publicId: true, displayName: true } },
          check: {
            select: {
              type: true,
              status: true,
              result: true,
              case: {
                select: {
                  publicId: true,
                  caseNumber: true,
                  status: true,
                  subject: { select: { fullName: true } },
                  client: { select: { displayName: true } },
                },
              },
            },
          },
        },
        orderBy: [{ dueAt: "asc" }, { publicId: "asc" }],
        ...paging(query.page, query.pageSize),
      }),
      this.prisma.checkTask.count({ where }),
    ]);
    const items = rows.map((row) => ({
      id: row.publicId,
      status: row.status,
      dueAt: row.dueAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      blockerReason: row.blockerReason,
      overdue: Boolean(
        row.dueAt && row.dueAt < now && activeTaskStatuses.includes(row.status),
      ),
      assignee: row.assignee
        ? { id: row.assignee.publicId, displayName: row.assignee.displayName }
        : null,
      checkType: row.check.type,
      checkStatus: row.check.status,
      result: row.check.result,
      caseId: row.check.case.publicId,
      caseNumber: row.check.case.caseNumber,
      caseStatus: row.check.case.status,
      candidateName: row.check.case.subject.fullName,
      clientName: row.check.case.client.displayName,
    }));
    return pageResult(items, total, query.page, query.pageSize);
  }

  async visits(actor: Actor, query: SpocVisitQueryDto) {
    const text = query.search?.trim();
    const base = {
      tenantId: actor.tenantId,
      case: spocCaseWhere(actor, query),
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId ? { assignee: { publicId: query.assigneeId } } : {}),
      ...(text
        ? {
            OR: [
              { address: { contains: text } },
              { case: { caseNumber: { contains: text } } },
              { case: { subject: { fullName: { contains: text } } } },
            ],
          }
        : {}),
    };
    const ctx = bucketContext(actor, query, new Date());
    const where = withBucket(
      base,
      query.bucket ? visitBucket(query.bucket, ctx) : null,
    );
    const [rows, total] = await Promise.all([
      this.prisma.fieldVisit.findMany({
        where,
        select: {
          publicId: true,
          status: true,
          address: true,
          geofenceMeters: true,
          distanceMeters: true,
          checkedInAt: true,
          completedAt: true,
          createdAt: true,
          assignee: { select: { publicId: true, displayName: true } },
          _count: { select: { evidence: true } },
          case: {
            select: {
              publicId: true,
              caseNumber: true,
              status: true,
              dueAt: true,
              subject: { select: { fullName: true } },
              client: { select: { displayName: true } },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { publicId: "asc" }],
        ...paging(query.page, query.pageSize),
      }),
      this.prisma.fieldVisit.count({ where }),
    ]);
    const items = rows.map((row) => {
      const distance =
        row.distanceMeters === null ? null : Number(row.distanceMeters);
      return {
        id: row.publicId,
        status: row.status,
        address: row.address,
        geofenceMeters: row.geofenceMeters,
        distanceMeters: distance,
        outsideGeofence: Boolean(
          row.checkedInAt && distance !== null && distance > row.geofenceMeters,
        ),
        checkedInAt: row.checkedInAt,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
        evidenceCount: row._count.evidence,
        assignee: row.assignee
          ? { id: row.assignee.publicId, displayName: row.assignee.displayName }
          : null,
        caseId: row.case.publicId,
        caseNumber: row.case.caseNumber,
        caseStatus: row.case.status,
        caseDueAt: row.case.dueAt,
        candidateName: row.case.subject.fullName,
        clientName: row.case.client.displayName,
      };
    });
    return pageResult(items, total, query.page, query.pageSize);
  }

  async opportunities(actor: Actor, query: SpocOpportunityQueryDto) {
    const now = new Date();
    const text = query.search?.trim();
    const open = { stage: { notIn: ["WON", "LOST"] } };
    const base = {
      tenantId: actor.tenantId,
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.ownerId ? { owner: { publicId: query.ownerId } } : {}),
      ...resolveSpocClients(actor, query.clientId).byClient,
      ...(query.followUp === "overdue"
        ? { ...open, nextFollowUpAt: { lt: now } }
        : {}),
      ...(query.followUp === "none" ? { ...open, nextFollowUpAt: null } : {}),
      ...(text
        ? {
            OR: [
              { companyName: { contains: text } },
              { contactName: { contains: text } },
              { city: { contains: text } },
            ],
          }
        : {}),
    };
    const ctx = bucketContext(actor, query, new Date());
    const where = withBucket(
      base,
      query.bucket ? opportunityBucket(query.bucket, ctx) : null,
    );
    const [rows, total] = await Promise.all([
      this.prisma.salesOpportunity.findMany({
        where,
        select: {
          publicId: true,
          companyName: true,
          contactName: true,
          city: true,
          stage: true,
          estimatedValue: true,
          probability: true,
          nextFollowUpAt: true,
          onboardingHandoffAt: true,
          closedAt: true,
          updatedAt: true,
          owner: { select: { publicId: true, displayName: true } },
          client: {
            select: { publicId: true, displayName: true, status: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { publicId: "asc" }],
        ...paging(query.page, query.pageSize),
      }),
      this.prisma.salesOpportunity.count({ where }),
    ]);
    const items = rows.map(
      ({ publicId, estimatedValue, owner, client, ...row }) => ({
        id: publicId,
        ...row,
        estimatedValue: Number(estimatedValue),
        followUpOverdue: Boolean(
          row.nextFollowUpAt &&
          row.nextFollowUpAt < now &&
          !["WON", "LOST"].includes(row.stage),
        ),
        owner: owner
          ? { id: owner.publicId, displayName: owner.displayName }
          : null,
        client: client
          ? {
              id: client.publicId,
              displayName: client.displayName,
              status: client.status,
            }
          : null,
      }),
    );
    return pageResult(items, total, query.page, query.pageSize);
  }

  async invoices(actor: Actor, query: SpocInvoiceQueryDto) {
    const now = new Date();
    const text = query.search?.trim();
    const unsettled = {
      status: { notIn: [...settledInvoiceStatuses, "DRAFT"] },
    };
    const base = {
      tenantId: actor.tenantId,
      ...(query.status === "OVERDUE"
        ? { ...unsettled, dueAt: { lt: now } }
        : query.status
          ? { status: query.status }
          : { status: { not: "DRAFT" } }),
      ...resolveSpocClients(actor, query.clientId).byClient,
      ...(text
        ? {
            OR: [
              { invoiceNumber: { contains: text } },
              { client: { displayName: { contains: text } } },
            ],
          }
        : {}),
    };
    const ctx = bucketContext(actor, query, new Date());
    const where = withBucket(
      base,
      query.bucket
        ? query.bucket === "exceptions"
          ? { id: -1n }
          : invoiceBucket(query.bucket, ctx)
        : null,
    );
    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        select: {
          publicId: true,
          invoiceNumber: true,
          status: true,
          issuedAt: true,
          dueAt: true,
          totalAmount: true,
          paidAmount: true,
          creditedAmount: true,
          client: { select: { publicId: true, displayName: true } },
        },
        orderBy: [{ dueAt: "asc" }, { publicId: "asc" }],
        ...paging(query.page, query.pageSize),
      }),
      this.prisma.invoice.count({ where }),
    ]);
    const items = rows.map((row) => {
      const settled = (settledInvoiceStatuses as readonly string[]).includes(
        row.status,
      );
      const total = Number(row.totalAmount);
      const paid = Number(row.paidAmount);
      const credited = Number(row.creditedAmount);
      return {
        id: row.publicId,
        invoiceNumber: row.invoiceNumber,
        status:
          !settled && row.dueAt && row.dueAt < now ? "OVERDUE" : row.status,
        issuedAt: row.issuedAt,
        dueAt: row.dueAt,
        totalAmount: total,
        paidAmount: paid,
        creditedAmount: credited,
        balance: Math.max(0, total - paid - credited),
        client: {
          id: row.client.publicId,
          displayName: row.client.displayName,
        },
      };
    });
    return pageResult(items, total, query.page, query.pageSize);
  }
}

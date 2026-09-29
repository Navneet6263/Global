import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { caseEvidenceReadiness } from "../documents/evidence-readiness";
import type { Prisma } from "../generated/prisma/client";
import { paging } from "../spoc/spoc-scope";
import { OPEN_CLARIFICATION_STATUSES } from "./services/support-rules";

const name = { select: { displayName: true } } as const;

/**
 * Allow-list for employee rows. Candidate contact details, encrypted PII, file keys,
 * findings, QA notes and money are never selected for the support desk.
 */
export const employeeSelect = {
  id: true,
  publicId: true,
  caseNumber: true,
  status: true,
  priority: true,
  dueAt: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  subject: { select: { fullName: true } },
  client: { select: { publicId: true, displayName: true } },
  branch: { select: { name: true, city: true } },
  assignedOpsUser: name,
  qaReviewer: name,
  checks: {
    select: {
      status: true,
      tasks: { select: { status: true, assignee: name } },
    },
  },
  fieldVisits: { select: { status: true, assignee: name } },
  documents: { select: { status: true, currentVersion: true } },
  clarifications: {
    where: { status: { in: OPEN_CLARIFICATION_STATUSES } },
    select: { status: true },
  },
} as const;

export type EmployeeRow = Prisma.VerificationCaseGetPayload<{
  select: typeof employeeSelect;
}>;

export const employeeDetailSelect = {
  ...employeeSelect,
  checks: {
    select: {
      type: true,
      status: true,
      completedAt: true,
      tasks: {
        select: {
          status: true,
          dueAt: true,
          blockerReason: true,
          assignee: name,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  documents: {
    select: {
      publicId: true,
      type: true,
      status: true,
      currentVersion: true,
      reviewNote: true,
      updatedAt: true,
      versions: {
        where: { malwareState: "CLEAN" },
        orderBy: { version: "desc" as const },
        take: 1,
        select: { createdAt: true },
      },
      vendorAssignments: { select: { attempt: true, status: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  clarifications: {
    select: { subject: true, status: true, dueAt: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
  },
  consents: {
    select: { status: true },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
  reports: { select: { status: true } },
  statusHistory: {
    select: { fromStatus: true, toStatus: true, reason: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

export type EmployeeDetailRow = Prisma.VerificationCaseGetPayload<{
  select: typeof employeeDetailSelect;
}>;

type ClientIds = { tenantId: bigint; clientId: { in: bigint[] } };

/** Read-only data access for the support desk directory (clients and employees). */
@Injectable()
export class SupportDirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  countClients(where: Prisma.ClientWhereInput) {
    return this.prisma.client.count({ where });
  }

  countCases(where: Prisma.VerificationCaseWhereInput) {
    return this.prisma.verificationCase.count({ where });
  }

  countOpenRequests(tenantId: bigint) {
    return this.prisma.supportRequest.count({
      where: { tenantId, status: { not: "RESOLVED" } },
    });
  }

  async pageClients(
    where: Prisma.ClientWhereInput,
    page: number,
    pageSize: number,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: {
          id: true,
          publicId: true,
          code: true,
          displayName: true,
          status: true,
        },
        orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
        ...paging(page, pageSize),
      }),
      this.prisma.client.count({ where }),
    ]);
    return { rows, total };
  }

  /** Per client and case status: how many cases, and the latest update. */
  caseTotals(inPage: ClientIds) {
    return this.prisma.verificationCase.groupBy({
      by: ["clientId", "status"],
      where: inPage,
      _count: { _all: true },
      _max: { updatedAt: true },
    });
  }

  caseCountsWhere(
    inPage: ClientIds,
    filter: Prisma.VerificationCaseWhereInput,
  ) {
    return this.prisma.verificationCase.groupBy({
      by: ["clientId"],
      where: { ...inPage, ...filter },
      _count: { _all: true },
    });
  }

  openRequestCounts(inPage: ClientIds) {
    return this.prisma.supportRequest.groupBy({
      by: ["clientId"],
      where: { ...inPage, status: { not: "RESOLVED" } },
      _count: { _all: true },
    });
  }

  async pageEmployees(
    where: Prisma.VerificationCaseWhereInput,
    page: number,
    pageSize: number,
  ) {
    const [rows, total] = await Promise.all([
      this.prisma.verificationCase.findMany({
        where,
        select: employeeSelect,
        orderBy: [{ updatedAt: "desc" }, { publicId: "asc" }],
        ...paging(page, pageSize),
      }),
      this.prisma.verificationCase.count({ where }),
    ]);
    return { rows, total };
  }

  findEmployee(where: Prisma.VerificationCaseWhereInput) {
    return this.prisma.verificationCase.findFirst({
      where,
      select: employeeDetailSelect,
    });
  }

  /** The existing evidence-readiness issues ("AADHAAR: upload required", ...). */
  async pendingItems(caseId: bigint): Promise<string[]> {
    try {
      return (await caseEvidenceReadiness(this.prisma, caseId)).issues;
    } catch (error) {
      return [error instanceof Error ? error.message : "Readiness unavailable"];
    }
  }
}

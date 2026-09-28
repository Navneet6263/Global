import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";

import { PrismaService } from "../database/prisma.service";
import type { SpocExceptionQueryDto } from "./dto/spoc-exception.dto";
import {
  SLA_APPROACHING_HOURS,
  activeTaskStatuses,
  holderOf,
  openVisitStatuses,
  settledInvoiceStatuses,
  terminalCaseStatuses,
} from "./spoc-holder";
import { pageResult, paging, spocCaseWhere } from "./spoc-scope";

export const SpocExceptionCategories = [
  "overdue",
  "sla_approaching",
  "no_ops_owner",
  "checks_unassigned",
  "blocked_tasks",
  "qa_rework",
  "non_clear_results",
  "client_clarifications",
  "rejected_documents",
  "field_exception_review",
  "outside_geofence",
  "report_failed",
  "followup_overdue",
  "invoice_overdue",
  "credit_hold",
] as const;
export type SpocExceptionCategory = (typeof SpocExceptionCategories)[number];

export interface SpocExceptionItem {
  id: string;
  title: string;
  subtitle: string;
  caseId: string | null;
  status: string;
  owner: string | null;
  dueAt: Date | null;
  updatedAt: Date;
}

const caseFields = {
  publicId: true,
  caseNumber: true,
  status: true,
  dueAt: true,
  updatedAt: true,
  subject: { select: { fullName: true } },
  client: { select: { displayName: true } },
  assignedOpsUser: { select: { displayName: true } },
} as const;

type CaseFields = {
  publicId: string;
  caseNumber: string;
  status: string;
  dueAt: Date | null;
  updatedAt: Date;
  subject: { fullName: string };
  client: { displayName: string };
  assignedOpsUser: { displayName: string } | null;
};

function caseItem(
  row: CaseFields,
  id = row.publicId,
  detail?: string,
): SpocExceptionItem {
  return {
    id,
    title: row.subject.fullName,
    subtitle: [row.caseNumber, row.client.displayName, detail]
      .filter(Boolean)
      .join(" · "),
    caseId: row.publicId,
    status: row.status,
    owner:
      row.assignedOpsUser?.displayName ??
      (holderOf(row.status) === "NONE" ? null : "Unassigned"),
    dueAt: row.dueAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class SpocExceptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: SpocExceptionQueryDto) {
    const now = new Date();
    const soon = new Date(now.getTime() + SLA_APPROACHING_HOURS * 3_600_000);
    const tenantId = actor.tenantId;
    const scope = spocCaseWhere(actor, query);
    const live = { ...scope, status: { notIn: terminalCaseStatuses } };
    const clientFilter = query.clientId
      ? { client: { publicId: query.clientId } }
      : {};
    const p = paging(query.page, query.pageSize);
    const order = [
      { updatedAt: "desc" as const },
      { publicId: "asc" as const },
    ];

    // Each category: a real where clause plus a list mapper onto one item shape.
    const defs: Record<
      SpocExceptionCategory,
      { count: () => Promise<number>; list: () => Promise<SpocExceptionItem[]> }
    > = {
      overdue: this.caseDef({ ...live, dueAt: { lt: now } }, p),
      sla_approaching: this.caseDef(
        { ...live, dueAt: { gte: now, lt: soon } },
        p,
      ),
      no_ops_owner: this.caseDef({ ...live, assignedOpsUserId: null }, p),
      checks_unassigned: {
        count: () =>
          this.prisma.caseCheck.count({
            where: this.unassignedChecks(tenantId, live),
          }),
        list: async () =>
          (
            await this.prisma.caseCheck.findMany({
              where: this.unassignedChecks(tenantId, live),
              orderBy: order,
              ...p,
              select: {
                publicId: true,
                type: true,
                case: { select: caseFields },
              },
            })
          ).map((row) =>
            caseItem(
              row.case,
              row.publicId,
              `${row.type} check has no active assignee`,
            ),
          ),
      },
      blocked_tasks: {
        count: () =>
          this.prisma.checkTask.count({
            where: { tenantId, status: "BLOCKED", check: { case: scope } },
          }),
        list: async () =>
          (
            await this.prisma.checkTask.findMany({
              where: { tenantId, status: "BLOCKED", check: { case: scope } },
              orderBy: order,
              ...p,
              select: {
                publicId: true,
                blockerReason: true,
                assignee: { select: { displayName: true } },
                check: { select: { type: true, case: { select: caseFields } } },
              },
            })
          ).map((row) => ({
            ...caseItem(
              row.check.case,
              row.publicId,
              row.blockerReason ?? `${row.check.type} blocked`,
            ),
            owner: row.assignee?.displayName ?? "Unassigned",
          })),
      },
      qa_rework: {
        count: () =>
          this.prisma.qaReview.count({
            where: { decision: "REWORK", case: live },
          }),
        list: async () =>
          (
            await this.prisma.qaReview.findMany({
              where: { decision: "REWORK", case: live },
              orderBy: [{ createdAt: "desc" }, { publicId: "asc" }],
              ...p,
              select: {
                publicId: true,
                reviewer: { select: { displayName: true } },
                case: { select: caseFields },
              },
            })
          ).map((row) =>
            caseItem(
              row.case,
              row.publicId,
              `Returned by ${row.reviewer.displayName}`,
            ),
          ),
      },
      non_clear_results: {
        count: () =>
          this.prisma.caseCheck.count({
            where: {
              tenantId,
              result: { in: ["DISCREPANCY", "UNABLE_TO_VERIFY"] },
              case: live,
            },
          }),
        list: async () =>
          (
            await this.prisma.caseCheck.findMany({
              where: {
                tenantId,
                result: { in: ["DISCREPANCY", "UNABLE_TO_VERIFY"] },
                case: live,
              },
              orderBy: order,
              ...p,
              select: {
                publicId: true,
                type: true,
                result: true,
                case: { select: caseFields },
              },
            })
          ).map((row) =>
            caseItem(row.case, row.publicId, `${row.type}: ${row.result}`),
          ),
      },
      client_clarifications: {
        count: () =>
          this.prisma.clarification.count({
            where: { tenantId, status: "OPEN", case: scope },
          }),
        list: async () =>
          (
            await this.prisma.clarification.findMany({
              where: { tenantId, status: "OPEN", case: scope },
              orderBy: order,
              ...p,
              select: {
                publicId: true,
                subject: true,
                dueAt: true,
                case: { select: caseFields },
              },
            })
          ).map((row) => ({
            ...caseItem(row.case, row.publicId, row.subject),
            dueAt: row.dueAt,
          })),
      },
      rejected_documents: {
        count: () =>
          this.prisma.document.count({
            where: {
              tenantId,
              status: { in: ["REJECTED", "REUPLOAD_REQUIRED"] },
              case: scope,
            },
          }),
        list: async () =>
          (
            await this.prisma.document.findMany({
              where: {
                tenantId,
                status: { in: ["REJECTED", "REUPLOAD_REQUIRED"] },
                case: scope,
              },
              orderBy: order,
              ...p,
              select: {
                publicId: true,
                type: true,
                status: true,
                case: { select: caseFields },
              },
            })
          ).map((row) =>
            caseItem(row.case, row.publicId, `${row.type} ${row.status}`),
          ),
      },
      field_exception_review: this.visitDef(
        { tenantId, status: "EXCEPTION_REVIEW", case: scope },
        p,
      ),
      outside_geofence: {
        count: async () => (await this.checkedInVisits(tenantId, scope)).length,
        list: async () =>
          (await this.checkedInVisits(tenantId, scope))
            .slice(p.skip, p.skip + p.take)
            .map((row) => ({
              ...caseItem(
                row.case,
                row.publicId,
                `${Math.round(Number(row.distanceMeters))} m from target (limit ${row.geofenceMeters} m)`,
              ),
              owner: row.assignee?.displayName ?? "Unassigned",
            })),
      },
      report_failed: {
        count: () =>
          this.prisma.report.count({
            where: { tenantId, status: "FAILED", case: scope },
          }),
        list: async () =>
          (
            await this.prisma.report.findMany({
              where: { tenantId, status: "FAILED", case: scope },
              orderBy: order,
              ...p,
              select: { publicId: true, case: { select: caseFields } },
            })
          ).map((row) =>
            caseItem(row.case, row.publicId, "Report generation failed"),
          ),
      },
      followup_overdue: {
        count: () =>
          this.prisma.salesOpportunity.count({
            where: this.followUps(tenantId, now, clientFilter),
          }),
        list: async () =>
          (
            await this.prisma.salesOpportunity.findMany({
              where: this.followUps(tenantId, now, clientFilter),
              orderBy: [{ nextFollowUpAt: "asc" }, { publicId: "asc" }],
              ...p,
              select: {
                publicId: true,
                companyName: true,
                stage: true,
                nextFollowUpAt: true,
                updatedAt: true,
                owner: { select: { displayName: true } },
              },
            })
          ).map((row) => ({
            id: row.publicId,
            title: row.companyName,
            subtitle: `Stage ${row.stage}`,
            caseId: null,
            status: row.stage,
            owner: row.owner?.displayName ?? "Unassigned",
            dueAt: row.nextFollowUpAt,
            updatedAt: row.updatedAt,
          })),
      },
      invoice_overdue: {
        count: () =>
          this.prisma.invoice.count({
            where: this.overdueInvoices(tenantId, now, clientFilter),
          }),
        list: async () =>
          (
            await this.prisma.invoice.findMany({
              where: this.overdueInvoices(tenantId, now, clientFilter),
              orderBy: [{ dueAt: "asc" }, { publicId: "asc" }],
              ...p,
              select: {
                publicId: true,
                invoiceNumber: true,
                totalAmount: true,
                paidAmount: true,
                creditedAmount: true,
                dueAt: true,
                updatedAt: true,
                client: { select: { displayName: true } },
              },
            })
          ).map((row) => ({
            id: row.publicId,
            title: row.invoiceNumber,
            subtitle: `${row.client.displayName} · balance ${Math.max(0, Number(row.totalAmount) - Number(row.paidAmount) - Number(row.creditedAmount)).toFixed(2)}`,
            caseId: null,
            status: "OVERDUE",
            owner: "Finance",
            dueAt: row.dueAt,
            updatedAt: row.updatedAt,
          })),
      },
      credit_hold: {
        count: () =>
          this.prisma.client.count({
            where: {
              tenantId,
              creditHold: true,
              ...(query.clientId ? { publicId: query.clientId } : {}),
            },
          }),
        list: async () =>
          (
            await this.prisma.client.findMany({
              where: {
                tenantId,
                creditHold: true,
                ...(query.clientId ? { publicId: query.clientId } : {}),
              },
              orderBy: order,
              ...p,
              select: {
                publicId: true,
                displayName: true,
                status: true,
                creditControlReason: true,
                updatedAt: true,
              },
            })
          ).map((row) => ({
            id: row.publicId,
            title: row.displayName,
            subtitle: row.creditControlReason ?? "New case intake is on hold",
            caseId: null,
            status: row.status,
            owner: "Finance",
            dueAt: null,
            updatedAt: row.updatedAt,
          })),
      },
    };

    const counts = await Promise.all(
      SpocExceptionCategories.map(async (category) => ({
        category,
        count: await defs[category].count(),
      })),
    );
    const selected = counts.find((row) => row.category === query.category);
    const items = await defs[query.category].list();
    return {
      categories: counts,
      category: query.category,
      ...pageResult(items, selected?.count ?? 0, query.page, query.pageSize),
    };
  }

  private caseDef(where: object, p: { skip: number; take: number }) {
    return {
      count: () => this.prisma.verificationCase.count({ where }),
      list: async () =>
        (
          await this.prisma.verificationCase.findMany({
            where,
            select: caseFields,
            orderBy: [{ dueAt: "asc" }, { publicId: "asc" }],
            ...p,
          })
        ).map((row) => caseItem(row)),
    };
  }

  private visitDef(where: object, p: { skip: number; take: number }) {
    return {
      count: () => this.prisma.fieldVisit.count({ where }),
      list: async () =>
        (
          await this.prisma.fieldVisit.findMany({
            where,
            orderBy: [{ updatedAt: "desc" }, { publicId: "asc" }],
            ...p,
            select: {
              publicId: true,
              address: true,
              assignee: { select: { displayName: true } },
              case: { select: caseFields },
            },
          })
        ).map((row) => ({
          ...caseItem(row.case, row.publicId, row.address),
          owner: row.assignee?.displayName ?? "Unassigned",
        })),
    };
  }

  private unassignedChecks(tenantId: bigint, live: object) {
    return {
      tenantId,
      status: { not: "COMPLETED" },
      case: { ...live, status: "IN_PROGRESS" },
      tasks: {
        none: {
          status: { in: activeTaskStatuses.filter((s) => s !== "UNASSIGNED") },
          assigneeId: { not: null },
        },
      },
    };
  }

  /** Column-to-column comparison is not expressible in Prisma, so open checked-in visits are filtered here. */
  private async checkedInVisits(tenantId: bigint, scope: object) {
    const rows = await this.prisma.fieldVisit.findMany({
      where: {
        tenantId,
        status: { in: openVisitStatuses },
        checkedInAt: { not: null },
        distanceMeters: { not: null },
        case: scope,
      },
      select: {
        publicId: true,
        geofenceMeters: true,
        distanceMeters: true,
        assignee: { select: { displayName: true } },
        case: { select: caseFields },
      },
      orderBy: [{ updatedAt: "desc" }, { publicId: "asc" }],
    });
    return rows.filter(
      (row) => Number(row.distanceMeters) > row.geofenceMeters,
    );
  }

  private followUps(tenantId: bigint, now: Date, clientFilter: object) {
    return {
      tenantId,
      stage: { notIn: ["WON", "LOST"] },
      nextFollowUpAt: { lt: now },
      ...clientFilter,
    };
  }

  private overdueInvoices(tenantId: bigint, now: Date, clientFilter: object) {
    return {
      tenantId,
      status: { notIn: [...settledInvoiceStatuses, "DRAFT"] },
      dueAt: { lt: now },
      ...clientFilter,
    };
  }
}

import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { CaseStatuses } from "../cases/case.constants";
import { PrismaService } from "../database/prisma.service";
import { attentionQueue } from "../dashboards/executive-analytics.helpers";
import { stageAgeing } from "../dashboards/executive-breakdowns";
import { businessHealth } from "../dashboards/executive-metrics";
import type { SpocOverviewQueryDto } from "./dto/spoc-query.dto";
import {
  SLA_APPROACHING_HOURS,
  holderOf,
  terminalCaseStatuses,
} from "./spoc-holder";
import { roleStatus } from "./spoc-role-status";
import { resolveSpocClients, spocCaseWhere, spocRange } from "./spoc-scope";

const activeCaseSelect = {
  publicId: true,
  caseNumber: true,
  status: true,
  priority: true,
  riskLevel: true,
  createdAt: true,
  updatedAt: true,
  dueAt: true,
  completedAt: true,
  subject: { select: { fullName: true } },
  client: { select: { publicId: true, displayName: true } },
  branch: { select: { publicId: true, name: true } },
  assignedOpsUser: { select: { publicId: true, displayName: true } },
  checks: {
    select: {
      type: true,
      status: true,
      result: true,
      createdAt: true,
      completedAt: true,
    },
  },
  clarifications: { select: { status: true } },
  fieldVisits: { select: { status: true } },
} as const;

@Injectable()
export class SpocOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: Actor, query: SpocOverviewQueryDto) {
    const now = new Date();
    const range = spocRange(query, now);
    const caseWhere = spocCaseWhere(actor, query);
    const clients = resolveSpocClients(actor, query.clientId);
    const clientScope = clients.byClient;
    // Only live work is loaded row-by-row; every other figure is a database count.
    const [
      activeRows,
      statusCounts,
      roles,
      openClarifications,
      rejectedDocuments,
      opportunities,
      invoices,
    ] = await Promise.all([
      this.prisma.verificationCase.findMany({
        where: { ...caseWhere, status: { notIn: terminalCaseStatuses } },
        select: activeCaseSelect,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.verificationCase.groupBy({
        by: ["status"],
        where: caseWhere,
        _count: { _all: true },
      }),
      roleStatus(this.prisma, {
        tenantId: actor.tenantId,
        caseWhere,
        clients,
        range,
        now,
      }),
      this.prisma.clarification.count({
        where: { tenantId: actor.tenantId, status: "OPEN", case: caseWhere },
      }),
      this.prisma.document.count({
        where: {
          tenantId: actor.tenantId,
          status: "REJECTED",
          case: caseWhere,
        },
      }),
      this.prisma.salesOpportunity.findMany({
        where: { tenantId: actor.tenantId, ...clientScope },
        select: { stage: true, estimatedValue: true, probability: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId: actor.tenantId,
          status: { not: "DRAFT" },
          ...clientScope,
        },
        select: {
          status: true,
          totalAmount: true,
          paidAmount: true,
          creditedAmount: true,
          dueAt: true,
        },
      }),
    ]);

    const soon = new Date(now.getTime() + SLA_APPROACHING_HOURS * 3_600_000);
    const counts = new Map(
      statusCounts.map((row) => [row.status, row._count._all]),
    );
    const ageing = new Map(
      stageAgeing(activeRows, now).map((row) => [row.status, row]),
    );
    const health = businessHealth(opportunities, invoices, now);
    const qa = roles.find((row) => row.role === "QA_REVIEWER");
    const ops = roles.find((row) => row.role === "OPS_MANAGER");

    return {
      generatedAt: now,
      window: range,
      kpis: {
        activeCases: activeRows.length,
        overdue: activeRows.filter((row) => row.dueAt && row.dueAt < now)
          .length,
        slaApproaching: activeRows.filter(
          (row) => row.dueAt && row.dueAt >= now && row.dueAt < soon,
        ).length,
        unassigned: activeRows.filter((row) => !row.assignedOpsUser).length,
        completed: ops?.completed ?? 0,
        qaRework: qa?.exceptions ?? 0,
        openClientActions: openClarifications + rejectedDocuments,
        outstanding: health.finance.outstanding,
        overdueReceivable: health.finance.overdue,
        openPipeline: health.crm.openPipeline,
      },
      roles,
      workflow: CaseStatuses.map((status) => ({
        status,
        holderRole: holderOf(status),
        count: counts.get(status) ?? 0,
        oldestAgeHours: ageing.get(status)?.oldestAgeHours ?? 0,
        atRisk: ageing.get(status)?.atRisk ?? 0,
      })),
      attention: attentionQueue(activeRows, now).map((item) => ({
        ...item,
        holderRole: holderOf(item.status),
      })),
      business: health,
    };
  }

  async filters(actor: Actor) {
    // A SPOC-RM only sees its assigned clients and the branches that serve them.
    const { byClient, clientRow } = resolveSpocClients(actor);
    const [clients, branches, users] = await Promise.all([
      this.prisma.client.findMany({
        where: { tenantId: actor.tenantId, ...clientRow },
        select: { publicId: true, displayName: true, status: true },
        orderBy: { displayName: "asc" },
      }),
      this.prisma.branch.findMany({
        where: {
          tenantId: actor.tenantId,
          isActive: true,
          ...("clientId" in byClient ? { cases: { some: byClient } } : {}),
        },
        select: { publicId: true, name: true, city: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.user.findMany({
        where: {
          tenantId: actor.tenantId,
          status: "ACTIVE",
          userRoles: {
            some: {
              role: {
                code: {
                  in: [
                    "OPS_MANAGER",
                    "VERIFIER",
                    "QA_REVIEWER",
                    "FIELD_EXECUTIVE",
                    "SALES_MANAGER",
                  ],
                },
              },
            },
          },
        },
        select: {
          publicId: true,
          displayName: true,
          userRoles: { select: { role: { select: { code: true } } } },
        },
        orderBy: { displayName: "asc" },
      }),
    ]);
    return {
      clients: clients.map(({ publicId, ...row }) => ({
        id: publicId,
        ...row,
      })),
      branches: branches.map(({ publicId, ...row }) => ({
        id: publicId,
        ...row,
      })),
      users: users.map((user) => ({
        id: user.publicId,
        displayName: user.displayName,
        roles: user.userRoles.map((entry) => entry.role.code),
      })),
    };
  }
}

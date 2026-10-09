import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import { RM_BUCKETS } from "../workflow/intake.service";

@Injectable()
export class NavigationCountsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor) {
    const scope = caseAccessScope(actor);
    const active = {
      ...scope,
      status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED", "STOPPED"] },
    };
    const now = new Date();
    if (
      actor.roles.includes("CLIENT_ADMIN") &&
      !actor.roles.includes("PLATFORM_ADMIN")
    ) {
      const [requests, rejected, clientReviews] = await Promise.all([
        this.prisma.clarification.count({
          where: { tenantId: actor.tenantId, case: scope, status: "OPEN" },
        }),
        this.prisma.document.count({
          where: { tenantId: actor.tenantId, case: scope, status: "REJECTED" },
        }),
        this.prisma.verificationCase.count({
          where: { ...scope, intakeStage: "CLIENT_REVIEW" },
        }),
      ]);
      return {
        counts: { clientActions: requests + rejected, clientReviews },
        generatedAt: now,
      };
    }
    // The RM sidebar counts its own cases by step, with the same rules as its queue.
    let rmCounts: Record<string, number> = {};
    if (actor.roles.includes("SPOC_RM")) {
      const mine = {
        ...scope,
        workflowVersion: 2,
        assignedOpsUserId: actor.userId,
      };
      const [
        rmActive,
        rmNeedsDataEntry,
        rmReady,
        rmFinal,
        rmCorrections,
        rmOverdue,
        rmEscalated,
      ] = await Promise.all([
        this.prisma.verificationCase.count({
          where: { ...mine, status: active.status },
        }),
        this.prisma.verificationCase.count({
          where: { ...mine, ...RM_BUCKETS["needs_data_entry"] },
        }),
        this.prisma.verificationCase.count({
          where: { ...mine, ...RM_BUCKETS["ready"] },
        }),
        this.prisma.verificationCase.count({
          where: { ...mine, ...RM_BUCKETS["final_approval"] },
        }),
        this.prisma.verificationCase.count({
          where: { ...mine, ...RM_BUCKETS["correction"] },
        }),
        this.prisma.verificationCase.count({
          where: { ...mine, status: active.status, dueAt: { lt: now } },
        }),
        this.prisma.verificationCase.count({
          where: { ...mine, status: active.status, escalatedAt: { not: null } },
        }),
      ]);
      rmCounts = {
        rmActive,
        rmActions: rmNeedsDataEntry + rmReady + rmFinal,
        rmNeedsDataEntry,
        rmReady,
        rmFinal,
        rmCorrections,
        rmOverdue,
        rmEscalated,
      };
      // An RM who also holds another working role (e.g. Data Entry) gets both sets.
      if (actor.roles.every((role) => role === "SPOC_RM"))
        return { counts: rmCounts, generatedAt: now };
    }
    const [
      activeCases,
      qaQueue,
      unassigned,
      overdue,
      urgentOverdue,
      clarifications,
      fieldExceptions,
      stopped,
      reopened,
      clientsWithoutRm,
      signups,
      escalated,
    ] = await Promise.all([
      this.prisma.verificationCase.count({ where: active }),
      this.prisma.verificationCase.count({
        where: { ...scope, status: "QA_REVIEW" },
      }),
      this.prisma.verificationCase.count({
        where: { ...active, assignedOpsUserId: null },
      }),
      this.prisma.verificationCase.count({
        where: { ...active, dueAt: { lt: now } },
      }),
      this.prisma.verificationCase.count({
        where: { ...active, dueAt: { lt: now }, priority: "URGENT" },
      }),
      this.prisma.clarification.count({
        where: {
          tenantId: actor.tenantId,
          case: scope,
          status: { in: ["OPEN", "RESPONDED"] },
        },
      }),
      this.prisma.fieldVisit.count({
        where: {
          tenantId: actor.tenantId,
          case: scope,
          status: "EXCEPTION_REVIEW",
        },
      }),
      this.prisma.verificationCase.count({
        where: { ...scope, status: "STOPPED" },
      }),
      // Re-opened = live cases that went through a controlled reopening.
      this.prisma.verificationCase.count({
        where: {
          ...active,
          managerReviews: { some: { decision: "REOPENED" } },
        },
      }),
      this.prisma.client.count({
        where: {
          tenantId: actor.tenantId,
          status: "ACTIVE",
          primaryRmUserId: null,
        },
      }),
      // Self sign-up companies still in onboarding (Operations approves them).
      this.prisma.client.count({
        where: {
          tenantId: actor.tenantId,
          status: "ONBOARDING",
          selfSignupAt: { not: null },
        },
      }),
      this.prisma.verificationCase.count({
        where: { ...active, escalatedAt: { not: null } },
      }),
    ]);
    return {
      counts: {
        ...rmCounts,
        activeCases,
        qaQueue,
        opsActiveCases: activeCases,
        opsUnassigned: unassigned,
        opsSlaRisk: overdue,
        opsClarifications: clarifications,
        opsExceptions: overdue + clarifications + fieldExceptions,
        opsStopped: stopped,
        opsReopened: reopened,
        opsClientsWithoutRm: clientsWithoutRm,
        opsSignups: signups,
        opsEscalated: escalated,
        criticalExceptions: urgentOverdue + fieldExceptions,
      },
      generatedAt: now,
    };
  }
}

import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class NavigationCountsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor) {
    const scope = caseAccessScope(actor);
    const active = {
      ...scope,
      status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
    };
    const now = new Date();
    if (
      actor.roles.includes("CLIENT_ADMIN") &&
      !actor.roles.includes("PLATFORM_ADMIN")
    ) {
      const [requests, rejected] = await Promise.all([
        this.prisma.clarification.count({
          where: { tenantId: actor.tenantId, case: scope, status: "OPEN" },
        }),
        this.prisma.document.count({
          where: { tenantId: actor.tenantId, case: scope, status: "REJECTED" },
        }),
      ]);
      return {
        counts: { clientActions: requests + rejected },
        generatedAt: now,
      };
    }
    const [
      activeCases,
      qaQueue,
      unassigned,
      overdue,
      urgentOverdue,
      clarifications,
      fieldExceptions,
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
    ]);
    return {
      counts: {
        activeCases,
        qaQueue,
        opsActiveCases: activeCases,
        opsUnassigned: unassigned,
        opsSlaRisk: overdue,
        opsClarifications: clarifications,
        opsExceptions: overdue + clarifications + fieldExceptions,
        criticalExceptions: urgentOverdue + fieldExceptions,
      },
      generatedAt: now,
    };
  }
}

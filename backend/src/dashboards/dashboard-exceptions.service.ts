import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class DashboardExceptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor) {
    const scope = caseAccessScope(actor);
    const now = new Date();
    const overdueWhere = {
      ...scope,
      dueAt: { lt: now },
      status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
    };
    const clarificationWhere = {
      tenantId: actor.tenantId,
      status: { in: ["OPEN", "RESPONDED"] },
      case: caseAccessScope(actor),
    };
    const fieldWhere = {
      tenantId: actor.tenantId,
      status: "EXCEPTION_REVIEW",
      case: caseAccessScope(actor),
    };
    const [
      overdue,
      clarifications,
      fieldVisits,
      rejectedDocuments,
      resolvedToday,
    ] = await Promise.all([
      this.prisma.verificationCase.findMany({
        where: overdueWhere,
        select: {
          publicId: true,
          caseNumber: true,
          status: true,
          priority: true,
          dueAt: true,
          createdAt: true,
          subject: { select: { fullName: true } },
          client: { select: { displayName: true } },
        },
        orderBy: { dueAt: "asc" },
      }),
      this.prisma.clarification.findMany({
        where: clarificationWhere,
        select: {
          publicId: true,
          status: true,
          subject: true,
          dueAt: true,
          updatedAt: true,
          createdAt: true,
          messages: {
            select: { senderType: true, body: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          case: {
            select: {
              publicId: true,
              caseNumber: true,
              subject: { select: { fullName: true } },
              client: { select: { displayName: true } },
            },
          },
        },
        orderBy: [{ status: "desc" }, { updatedAt: "asc" }],
      }),
      this.prisma.fieldVisit.findMany({
        where: fieldWhere,
        select: {
          publicId: true,
          address: true,
          distanceMeters: true,
          geofenceMeters: true,
          capturedAt: true,
          createdAt: true,
          version: true,
          case: {
            select: {
              publicId: true,
              caseNumber: true,
              subject: { select: { fullName: true } },
              client: { select: { displayName: true } },
            },
          },
          assignee: { select: { displayName: true } },
        },
        orderBy: { capturedAt: "asc" },
      }),
      this.prisma.document.findMany({
        where: {
          tenantId: actor.tenantId,
          status: "REJECTED",
          case: caseAccessScope(actor),
        },
        select: {
          publicId: true,
          type: true,
          status: true,
          updatedAt: true,
          case: {
            select: {
              publicId: true,
              caseNumber: true,
              subject: { select: { fullName: true } },
              client: { select: { displayName: true } },
            },
          },
        },
        orderBy: { updatedAt: "asc" },
      }),
      this.resolvedToday(actor, now),
    ]);
    const affectedCaseIds = new Set([
      ...overdue.map((row) => row.publicId),
      ...clarifications.map((row) => row.case.publicId),
      ...fieldVisits.map((row) => row.case.publicId),
      ...rejectedDocuments.map((row) => row.case.publicId),
    ]);
    const ages = [
      ...overdue.map((row) => ageHours(row.createdAt, now)),
      ...clarifications.map((row) => ageHours(row.createdAt, now)),
      ...fieldVisits.map((row) => ageHours(row.createdAt, now)),
      ...rejectedDocuments.map((row) => ageHours(row.updatedAt, now)),
    ];
    const overdueCount = overdue.length;
    const clarificationCount = clarifications.length;
    const fieldCount = fieldVisits.length;
    return {
      summary: {
        overdue: overdueCount,
        clarifications: clarificationCount,
        fieldExceptions: fieldCount,
        rejectedDocuments: rejectedDocuments.length,
        total: overdueCount + clarificationCount + fieldCount,
        uniqueCases: affectedCaseIds.size,
        critical:
          overdue.filter((row) => row.priority === "URGENT").length +
          fieldCount,
        resolvedToday,
        clientActions:
          clarifications.filter((row) => row.status === "OPEN").length +
          rejectedDocuments.length,
        averageAgeHours: ages.length
          ? Math.round(
              ages.reduce((total, age) => total + age, 0) / ages.length,
            )
          : 0,
      },
      overdue: overdue.map(({ publicId, ...row }) => ({
        id: publicId,
        ...row,
      })),
      clarifications: clarifications.map(({ publicId, messages, ...row }) => ({
        id: publicId,
        ...row,
        latestMessage: messages[0] ?? null,
      })),
      fieldVisits: presentFieldExceptions(actor, fieldVisits),
      rejectedDocuments: rejectedDocuments.map(({ publicId, ...row }) => ({
        id: publicId,
        ...row,
      })),
      generatedAt: now,
    };
  }

  private async resolvedToday(actor: Actor, now: Date) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const counts = await Promise.all([
      this.prisma.clarification.count({
        where: {
          tenantId: actor.tenantId,
          status: "RESOLVED",
          resolvedAt: { gte: start },
          case: caseAccessScope(actor),
        },
      }),
      this.prisma.fieldVisit.count({
        where: {
          tenantId: actor.tenantId,
          status: "COMPLETED",
          completedAt: { gte: start },
          case: caseAccessScope(actor),
        },
      }),
    ]);
    return counts.reduce((sum, count) => sum + count, 0);
  }
}

function ageHours(createdAt: Date, now: Date) {
  return (now.getTime() - createdAt.getTime()) / 3_600_000;
}

export function presentFieldExceptions(
  actor: Actor,
  rows: Array<{ publicId: string } & Record<string, unknown>>,
) {
  if (actor.roles.includes("CLIENT_ADMIN")) return [];
  return rows.map(({ publicId, ...item }) => ({ id: publicId, ...item }));
}

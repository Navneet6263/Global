import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import {
  ACTIVE_TASK_STATUSES,
  resolveTaskAccessScope,
  startOfDay,
  taskSlaWhere,
  type TaskSlaFilter,
} from "./task-query.helpers";

export type MineTaskQuery = {
  status?: string;
  view?: string;
  search?: string;
  cursor?: string;
  taskId?: string;
  departmentId?: string;
  sla?: TaskSlaFilter;
  limit: number;
};

@Injectable()
export class TaskQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(actor: Actor, query: MineTaskQuery) {
    const search = query.search?.trim();
    const access = await resolveTaskAccessScope(
      this.prisma,
      actor,
      query.departmentId,
    );
    const slaConstraint = query.sla ? taskSlaWhere(query.sla) : undefined;
    const searchConstraint = search
      ? {
          check: {
            OR: [
              { type: { contains: search } },
              { case: { caseNumber: { contains: search } } },
              { case: { subject: { fullName: { contains: search } } } },
              { case: { client: { displayName: { contains: search } } } },
            ],
          },
        }
      : undefined;
    const statusConstraint =
      query.view === "ACTIVE"
        ? { status: { in: ACTIVE_TASK_STATUSES } }
        : query.status
          ? { status: query.status }
          : undefined;
    const andClauses = [
      access,
      query.taskId ? { publicId: query.taskId } : undefined,
      statusConstraint,
      slaConstraint,
      searchConstraint,
    ].filter((item) => item !== undefined);
    const where = andClauses.length === 1 ? andClauses[0] : { AND: andClauses };
    const rows = await this.prisma.checkTask.findMany({
      where,
      select: {
        publicId: true,
        status: true,
        instructions: true,
        dueAt: true,
        startedAt: true,
        completedAt: true,
        blockerReason: true,
        blockedAt: true,
        version: true,
        assignee: { select: { publicId: true, displayName: true } },
        check: {
          select: {
            id: true,
            publicId: true,
            type: true,
            status: true,
            initiationJson: true,
            initiatedAt: true,
            department: {
              select: { publicId: true, name: true, teamType: true },
            },
            result: true,
            riskLevel: true,
            sourceSummary: true,
            findings: {
              select: {
                publicId: true,
                kind: true,
                severity: true,
                title: true,
                description: true,
                source: true,
              },
              orderBy: { createdAt: "asc" },
            },
            case: {
              select: {
                publicId: true,
                caseNumber: true,
                priority: true,
                subject: { select: { publicId: true, fullName: true } },
                client: { select: { publicId: true, displayName: true } },
                clarifications: {
                  where: { level: "L2" },
                  select: {
                    publicId: true,
                    level: true,
                    status: true,
                    subject: true,
                    checkId: true,
                    requestedDocumentType: true,
                    submittedDocumentVersion: true,
                    opsReviewedAt: true,
                    reentryCompletedAt: true,
                    rejectionCount: true,
                    lastRejectedReason: true,
                    dueAt: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: "desc" },
                },
              },
            },
          },
        },
      },
      orderBy:
        query.status === "COMPLETED"
          ? [{ completedAt: "desc" }, { publicId: "asc" }]
          : [{ dueAt: "asc" }, { createdAt: "asc" }, { publicId: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const [active, overdue, blocked, completedToday] = await Promise.all([
      this.prisma.checkTask.count({
        where: { AND: [access, { status: { in: ACTIVE_TASK_STATUSES } }] },
      }),
      this.prisma.checkTask.count({
        where: {
          AND: [
            access,
            { status: { in: ACTIVE_TASK_STATUSES } },
            { dueAt: { lt: new Date() } },
          ],
        },
      }),
      this.prisma.checkTask.count({
        where: { AND: [access, { status: "BLOCKED" }] },
      }),
      this.prisma.checkTask.count({
        where: {
          AND: [
            access,
            { status: "COMPLETED" },
            { completedAt: { gte: startOfDay() } },
          ],
        },
      }),
    ]);
    return {
      items: page.map(({ publicId, assignee, check, ...row }) => {
        const {
          id: checkInternalId,
          department,
          case: { clarifications = [], ...caseRest },
          ...checkRest
        } = check;
        return {
          id: publicId,
          ...row,
          assignee: assignee
            ? { id: assignee.publicId, name: assignee.displayName }
            : null,
          check: {
            ...checkRest,
            department: department
              ? {
                  id: department.publicId,
                  name: department.name,
                  teamType: department.teamType,
                }
              : null,
            clarifications: clarifications
              .filter(
                (item) =>
                  checkInternalId !== undefined &&
                  item.checkId === checkInternalId,
              )
              .map((item) => ({
                id: item.publicId,
                level: item.level,
                status: item.status,
                subject: item.subject,
                requestedDocumentType: item.requestedDocumentType,
                submittedDocumentVersion: item.submittedDocumentVersion,
                opsReviewedAt: item.opsReviewedAt,
                reentryCompletedAt: item.reentryCompletedAt,
                rejectionCount: item.rejectionCount,
                lastRejectedReason: item.lastRejectedReason,
                dueAt: item.dueAt,
                createdAt: item.createdAt,
              })),
            case: caseRest,
          },
        };
      }),
      nextCursor: hasMore ? page.at(-1)?.publicId : null,
      summary: { active, overdue, blocked, completedToday },
    };
  }
}

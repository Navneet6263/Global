import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { L1ClarificationQueueQueryDto } from "./dto/l2-clarification.dto";

@Injectable()
export class ClarificationL1QueueService {
  constructor(private readonly prisma: PrismaService) {}

  async queue(actor: Actor, query: L1ClarificationQueueQueryDto) {
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const state = query.state ?? "all";
    const now = new Date();

    const statusWhere: Prisma.ClarificationWhereInput =
      state === "awaiting_client"
        ? { status: "OPEN" }
        : state === "response_received"
          ? { status: "RESPONDED" }
          : state === "overdue"
            ? { status: { in: ["OPEN", "RESPONDED"] }, dueAt: { lt: now } }
            : { status: { in: ["OPEN", "RESPONDED"] } };

    const where: Prisma.ClarificationWhereInput = {
      tenantId: actor.tenantId,
      AND: [
        { OR: [{ level: "L1" }, { level: null }] },
        statusWhere,
        ...(search
          ? [
              {
                OR: [
                  { subject: { contains: search } },
                  { case: { caseNumber: { contains: search } } },
                  { case: { subject: { fullName: { contains: search } } } },
                  { case: { client: { displayName: { contains: search } } } },
                ],
              },
            ]
          : []),
      ],
      case: caseAccessScope(actor),
    };

    const rows = await this.prisma.clarification.findMany({
      where,
      select: {
        publicId: true,
        status: true,
        level: true,
        subject: true,
        checkId: true,
        raisedById: true,
        dueAt: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
        case: {
          select: {
            publicId: true,
            caseNumber: true,
            status: true,
            subject: { select: { fullName: true } },
            client: { select: { publicId: true, displayName: true } },
          },
        },
        messages: {
          select: { senderType: true, body: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ status: "desc" }, { updatedAt: "asc" }],
      take: limit,
    });

    const checkIds = [
      ...new Set(
        rows.map((r) => r.checkId).filter((id): id is bigint => id != null),
      ),
    ];
    const userIds = [
      ...new Set(
        rows.map((r) => r.raisedById).filter((id): id is bigint => id != null),
      ),
    ];

    const [checks, users] = await Promise.all([
      checkIds.length && typeof this.prisma.caseCheck?.findMany === "function"
        ? this.prisma.caseCheck.findMany({
            where: { id: { in: checkIds } },
            select: { id: true, publicId: true, type: true, status: true },
          })
        : Promise.resolve([]),
      userIds.length && typeof this.prisma.user?.findMany === "function"
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, publicId: true, displayName: true },
          })
        : Promise.resolve([]),
    ]);

    const checksById = new Map(checks.map((c) => [c.id, c]));
    const usersById = new Map(users.map((u) => [u.id, u]));

    return {
      items: rows.map((row) => {
        const check = row.checkId ? checksById.get(row.checkId) : undefined;
        const raisedBy = row.raisedById
          ? usersById.get(row.raisedById)
          : undefined;
        const latest = row.messages[0] ?? null;
        return {
          id: row.publicId,
          caseId: row.case.publicId,
          caseNumber: row.case.caseNumber,
          caseStatus: row.case.status,
          candidateName: row.case.subject.fullName,
          clientId: row.case.client.publicId,
          clientName: row.case.client.displayName,
          checkType: check?.type ?? null,
          status: row.status,
          level: row.level,
          subject: row.subject,
          raisedBy: raisedBy
            ? { id: raisedBy.publicId, displayName: raisedBy.displayName }
            : null,
          dueAt: row.dueAt,
          overdue: Boolean(
            row.dueAt && row.dueAt < now && row.status !== "RESOLVED",
          ),
          resolvedAt: row.resolvedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          latestMessage: latest,
        };
      }),
    };
  }
}

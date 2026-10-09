import { roleIs } from "../common/auth/role-filter";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type {
  AssignClientRmDto,
  ClientRmQueryDto,
  IntakeRulesDto,
} from "./dto/workflow.dto";
import { isUniqueConflict } from "../vendor-requests/services/vendor-rules";
import { trimNote } from "./workflow-access";

const OPEN = { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] };

/**
 * Company-level RM: Operations assigns one RM per client once. New cases of that client are
 * assigned automatically; existing open cases move only when Operations chooses to.
 */
@Injectable()
export class ClientRmService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: ClientRmQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const where: Prisma.ClientWhereInput = {
      tenantId: actor.tenantId,
      status: "ACTIVE",
      ...(search
        ? {
            OR: [
              { displayName: { contains: search } },
              { code: { contains: search } },
            ],
          }
        : {}),
      ...(query.view === "without_rm" ? { primaryRmUserId: null } : {}),
      ...(query.view === "with_rm" ? { primaryRmUserId: { not: null } } : {}),
    };
    const [rows, total, withoutRm] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          publicId: true,
          code: true,
          displayName: true,
          version: true,
          primaryRmAssignedAt: true,
          clientReviewFirst: true,
          defaultDataEntryUser: {
            select: { publicId: true, displayName: true, status: true },
          },
          primaryRm: {
            select: { publicId: true, displayName: true, status: true },
          },
          spocScopes: {
            where: {
              user: {
                status: "ACTIVE",
                userRoles: { some: { role: { code: "SPOC_RM" } } },
              },
            },
            select: { user: { select: { publicId: true, displayName: true } } },
          },
        },
      }),
      this.prisma.client.count({ where }),
      this.prisma.client.count({
        where: {
          tenantId: actor.tenantId,
          status: "ACTIVE",
          primaryRmUserId: null,
        },
      }),
    ]);
    const ids = rows.map((row) => row.id);
    const [open, unassigned] = ids.length
      ? await Promise.all([
          this.prisma.verificationCase.groupBy({
            by: ["clientId"],
            where: {
              tenantId: actor.tenantId,
              clientId: { in: ids },
              status: OPEN,
            },
            _count: { _all: true },
          }),
          this.prisma.verificationCase.groupBy({
            by: ["clientId"],
            where: {
              tenantId: actor.tenantId,
              clientId: { in: ids },
              status: OPEN,
              assignedOpsUserId: null,
            },
            _count: { _all: true },
          }),
        ])
      : [[], []];
    const openBy = new Map(open.map((row) => [row.clientId, row._count._all]));
    const unassignedBy = new Map(
      unassigned.map((row) => [row.clientId, row._count._all]),
    );
    return {
      items: rows.map((row) => ({
        id: row.publicId,
        code: row.code,
        name: row.displayName,
        version: row.version,
        primaryRm: row.primaryRm
          ? {
              id: row.primaryRm.publicId,
              name: row.primaryRm.displayName,
              active: row.primaryRm.status === "ACTIVE",
            }
          : null,
        primaryRmAssignedAt: row.primaryRmAssignedAt,
        intakeRules: {
          clientReviewFirst: row.clientReviewFirst,
          defaultDataEntry: row.defaultDataEntryUser
            ? {
                id: row.defaultDataEntryUser.publicId,
                name: row.defaultDataEntryUser.displayName,
                active: row.defaultDataEntryUser.status === "ACTIVE",
              }
            : null,
        },
        mappedRms: row.spocScopes.map(({ user }) => ({
          id: user.publicId,
          name: user.displayName,
        })),
        openCases: openBy.get(row.id) ?? 0,
        casesWithoutRm: unassignedBy.get(row.id) ?? 0,
      })),
      total,
      page,
      pageSize,
      counts: { withoutRm },
    };
  }

  /**
   * Intake rules for one company (BGV process): Route A — the client reviews its
   * candidate's submission first; and auto-assignment — new submissions go straight to a
   * chosen Data Entry user. Operations / Platform Admin only; audited.
   */
  async setIntakeRules(
    actor: Actor,
    clientPublicId: string,
    input: IntakeRulesDto,
  ) {
    const client = await this.prisma.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: clientPublicId,
        status: { in: ["ACTIVE", "ONBOARDING"] },
      },
      select: {
        id: true,
        version: true,
        clientReviewFirst: true,
        defaultDataEntryUser: { select: { publicId: true } },
      },
    });
    if (!client) throw new NotFoundException("Client not found");
    if (client.version !== input.version)
      throw new ConflictException(
        "Client changed since it was loaded; refresh and try again",
      );
    let dataEntryId: bigint | null | undefined;
    if (input.defaultDataEntryUserId === null) dataEntryId = null;
    else if (input.defaultDataEntryUserId) {
      const user = await this.prisma.user.findFirst({
        where: {
          tenantId: actor.tenantId,
          publicId: input.defaultDataEntryUserId,
          status: "ACTIVE",
          userRoles: { some: { role: roleIs("DATA_ENTRY") } },
        },
        select: { id: true },
      });
      if (!user)
        throw new BadRequestException("Choose an active Data Entry user");
      dataEntryId = user.id;
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.client.updateMany({
        where: { id: client.id, version: input.version },
        data: {
          ...(dataEntryId !== undefined
            ? { defaultDataEntryUserId: dataEntryId }
            : {}),
          ...(input.clientReviewFirst !== undefined
            ? { clientReviewFirst: input.clientReviewFirst }
            : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Client changed since it was loaded; refresh and try again",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.intake-rules-updated",
          resourceType: "client",
          resourcePublicId: clientPublicId,
          beforeJson: JSON.stringify({
            clientReviewFirst: client.clientReviewFirst,
            defaultDataEntryUserId:
              client.defaultDataEntryUser?.publicId ?? null,
          }),
          afterJson: JSON.stringify({
            clientReviewFirst:
              input.clientReviewFirst ?? client.clientReviewFirst,
            defaultDataEntryUserId:
              input.defaultDataEntryUserId === undefined
                ? (client.defaultDataEntryUser?.publicId ?? null)
                : input.defaultDataEntryUserId,
          }),
        },
      });
    });
    return { id: clientPublicId, version: client.version + 1 };
  }

  async assign(actor: Actor, clientPublicId: string, input: AssignClientRmDto) {
    const client = await this.prisma.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: clientPublicId,
        // Onboarding (self sign-up) companies get their RM before activation.
        status: { in: ["ACTIVE", "ONBOARDING"] },
      },
      select: {
        id: true,
        displayName: true,
        version: true,
        primaryRmUserId: true,
        primaryRm: { select: { publicId: true, displayName: true } },
      },
    });
    if (!client)
      throw new NotFoundException("Active or onboarding client not found");
    if (client.version !== input.version)
      throw new ConflictException(
        "Client changed since it was loaded; refresh and try again",
      );
    const rm = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.rmUserId,
        status: "ACTIVE",
        clientId: null,
        userRoles: { some: { role: { code: "SPOC_RM" } } },
      },
      select: { id: true, publicId: true, displayName: true },
    });
    if (!rm) throw new BadRequestException("Choose an active RM / SPOC user");
    const apply = input.apply ?? "UNASSIGNED";
    if (rm.id === client.primaryRmUserId && apply === "NONE")
      throw new ConflictException(
        `${rm.displayName} is already the RM for ${client.displayName}`,
      );
    const note = trimNote(input.note);
    const caseWhere: Prisma.VerificationCaseWhereInput = {
      tenantId: actor.tenantId,
      clientId: client.id,
      status: OPEN,
      ...(apply === "UNASSIGNED"
        ? { assignedOpsUserId: null }
        : {
            OR: [
              { assignedOpsUserId: null },
              { assignedOpsUserId: { not: rm.id } },
            ],
          }),
    };
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.client.updateMany({
        where: { id: client.id, version: input.version },
        data: {
          primaryRmUserId: rm.id,
          primaryRmAssignedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Client changed since it was loaded; refresh and try again",
        );
      // The RM's workspace scope must include the client it now owns.
      const scope = await tx.spocClientScope.findUnique({
        where: { userId_clientId: { userId: rm.id, clientId: client.id } },
        select: { userId: true },
      });
      if (!scope) {
        try {
          await tx.spocClientScope.create({
            data: { userId: rm.id, clientId: client.id },
          });
        } catch (error) {
          // Databases that allow one SPOC scope per client reject a second RM: roll back cleanly.
          if (isUniqueConflict(error))
            throw new ConflictException(
              `${client.displayName} is already mapped to another RM. Remove that RM's company access in Users, then assign again.`,
            );
          throw error;
        }
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "user.client-scope-added",
            resourceType: "user",
            resourcePublicId: rm.publicId,
            afterJson: JSON.stringify({
              clientId: clientPublicId,
              client: client.displayName,
              reason: "Company RM assignment",
            }),
          },
        });
      }
      const cases =
        apply === "NONE"
          ? []
          : await tx.verificationCase.findMany({
              where: caseWhere,
              select: {
                id: true,
                publicId: true,
                caseNumber: true,
                assignedOpsUserId: true,
              },
              take: 5000,
            });
      if (cases.length) {
        await tx.verificationCase.updateMany({
          where: { id: { in: cases.map((item) => item.id) } },
          data: { assignedOpsUserId: rm.id, version: { increment: 1 } },
        });
        await tx.auditEvent.createMany({
          data: cases.map((item) => ({
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "case.owner-assigned",
            resourceType: "case",
            resourcePublicId: item.publicId,
            afterJson: JSON.stringify({
              caseNumber: item.caseNumber,
              ownerId: rm.publicId,
              ownerName: rm.displayName,
              reason: "Company RM assignment",
              replacedOwner: item.assignedOpsUserId !== null,
            }),
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.primary-rm-assigned",
          resourceType: "client",
          resourcePublicId: clientPublicId,
          beforeJson: JSON.stringify({
            primaryRmId: client.primaryRm?.publicId ?? null,
          }),
          afterJson: JSON.stringify({
            primaryRmId: rm.publicId,
            primaryRmName: rm.displayName,
            apply,
            casesMoved: cases.length,
            note,
          }),
        },
      });
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: rm.id,
          type: "CLIENT_RM_ASSIGNED",
          title: `You are the RM for ${client.displayName}`,
          body: cases.length
            ? `New cases will come to you automatically. ${cases.length} open case(s) were moved to you.`
            : "New cases of this company will come to you automatically.",
          href: "/spoc-rm/work",
        },
      });
      return { moved: cases.length };
    });
    return {
      clientId: clientPublicId,
      primaryRm: { id: rm.publicId, name: rm.displayName },
      casesMoved: result.moved,
      version: client.version + 1,
    };
  }

  async clear(actor: Actor, clientPublicId: string, version: number) {
    const client = await this.prisma.client.findFirst({
      where: { tenantId: actor.tenantId, publicId: clientPublicId },
      select: {
        id: true,
        version: true,
        primaryRm: { select: { publicId: true } },
      },
    });
    if (!client) throw new NotFoundException("Client not found");
    if (client.version !== version)
      throw new ConflictException(
        "Client changed since it was loaded; refresh and try again",
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.client.updateMany({
        where: { id: client.id, version },
        data: {
          primaryRmUserId: null,
          primaryRmAssignedAt: null,
          version: { increment: 1 },
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.primary-rm-removed",
          resourceType: "client",
          resourcePublicId: clientPublicId,
          beforeJson: JSON.stringify({
            primaryRmId: client.primaryRm?.publicId ?? null,
          }),
        },
      });
    });
    // Existing cases keep their RM; only new cases stop being auto-assigned.
    return {
      clientId: clientPublicId,
      primaryRm: null,
      version: client.version + 1,
    };
  }
}

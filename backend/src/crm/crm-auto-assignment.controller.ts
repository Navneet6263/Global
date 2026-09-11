import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { IsInt, Min } from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { PrismaService } from "../database/prisma.service";
import { clientScope } from "./crm-opportunity.shared";

export class AutoAssignOpportunityDto {
  @IsInt() @Min(1) version!: number;
}
export function leastLoadedOwner<T extends { id: bigint; activeCount: number }>(
  owners: T[],
): T | undefined {
  return [...owners].sort(
    (a, b) =>
      a.activeCount - b.activeCount || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )[0];
}
@Controller("crm/opportunities/:opportunityId/auto-assign")
@RequireRoles("PLATFORM_ADMIN", "SALES_MANAGER")
@RequirePermissions(Permission.CrmWrite)
export class CrmAutoAssignmentController {
  constructor(private readonly prisma: PrismaService) {}
  @Post()
  async assign(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) id: string,
    @Body() input: AutoAssignOpportunityDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const key = `crm-allocation:${actor.tenantId}`;
      const lock = await tx.$queryRaw<
        Array<{ result: number }>
      >`DECLARE @result int; EXEC @result = sp_getapplock @Resource = ${key}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 2000; SELECT @result AS result;`;
      if ((lock[0]?.result ?? -1) < 0)
        throw new ConflictException(
          "Another allocation is running; retry shortly",
        );
      const opportunity = await tx.salesOpportunity.findFirst({
        where: {
          publicId: id,
          tenantId: actor.tenantId,
          ...clientScope(actor),
        },
        select: {
          id: true,
          clientId: true,
          ownerId: true,
          stage: true,
          version: true,
        },
      });
      if (!opportunity) throw new NotFoundException("Opportunity not found");
      if (["WON", "LOST"].includes(opportunity.stage))
        throw new BadRequestException(
          "Closed opportunities cannot be auto-assigned",
        );
      if (opportunity.ownerId !== null)
        throw new ConflictException(
          "This opportunity already has an owner; refresh before making an explicit reassignment",
        );
      const owners = await tx.user.findMany({
        where: {
          tenantId: actor.tenantId,
          status: "ACTIVE",
          ...(actor.branchId && !actor.roles.includes("PLATFORM_ADMIN")
            ? { branchId: actor.branchId }
            : {}),
          OR: [
            { clientId: null },
            ...(opportunity.clientId
              ? [{ clientId: opportunity.clientId }]
              : []),
          ],
          userRoles: { some: { role: { code: "SALES_MANAGER" } } },
        },
        take: 201,
        orderBy: { id: "asc" },
        select: {
          id: true,
          publicId: true,
          displayName: true,
          _count: {
            select: {
              ownedOpportunities: {
                where: { stage: { notIn: ["WON", "LOST"] } },
              },
            },
          },
        },
      });
      if (!owners.length)
        throw new BadRequestException(
          "No active Sales Manager is eligible for this client/branch",
        );
      if (owners.length > 200)
        throw new BadRequestException(
          "Use explicit owner selection for a team larger than 200 eligible owners",
        );
      const owner = leastLoadedOwner(
        owners.map((row) => ({
          ...row,
          activeCount: row._count.ownedOpportunities,
        })),
      )!;
      const changed = await tx.salesOpportunity.updateMany({
        where: { id: opportunity.id, version: input.version, ownerId: null },
        data: { ownerId: owner.id, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException(
          "Opportunity changed; refresh before assigning",
        );
      await tx.salesActivity.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          opportunityId: opportunity.id,
          type: "UPDATED",
          summary: `Least-loaded eligible owner assigned: ${owner.displayName}`,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "crm.owner-auto-assigned",
          resourceType: "sales-opportunity",
          resourcePublicId: id,
          afterJson: JSON.stringify({
            ownerId: owner.publicId,
            openWorkloadBeforeAssignment: owner.activeCount,
          }),
        },
      });
      return {
        ownerId: owner.publicId,
        ownerName: owner.displayName,
        version: input.version + 1,
      };
    });
  }
}

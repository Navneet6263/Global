import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { IsBoolean, IsInt, Min } from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { PrismaService } from "../database/prisma.service";
import { clientScope } from "./crm-opportunity.shared";

export class SetCrmSequenceDto {
  @IsInt() @Min(1) version!: number;
  @IsBoolean() enabled!: boolean;
}

@Controller("crm/opportunities/:opportunityId/follow-up-sequence")
@RequireRoles("PLATFORM_ADMIN", "SALES_MANAGER")
export class CrmSequenceController {
  constructor(private readonly prisma: PrismaService) {}
  private async opportunity(actor: Actor, id: string) {
    const row = await this.prisma.salesOpportunity.findFirst({
      where: { tenantId: actor.tenantId, publicId: id, ...clientScope(actor) },
      select: {
        id: true,
        version: true,
        stage: true,
        ownerId: true,
        nextFollowUpAt: true,
        followUpSequenceStep: true,
        followUpSequenceStartedAt: true,
      },
    });
    if (!row) throw new NotFoundException("Opportunity not found");
    return row;
  }
  @Get()
  @RequirePermissions(Permission.CrmRead)
  async get(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) id: string,
  ) {
    const {
      id: _internal,
      ownerId,
      ...row
    } = await this.opportunity(actor, id);
    void _internal; // Internal database IDs are deliberately excluded from the public DTO.
    return { ...row, hasOwner: ownerId !== null, delivery: "IN_APP" };
  }
  @Post()
  @RequirePermissions(Permission.CrmWrite)
  async set(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) id: string,
    @Body() input: SetCrmSequenceDto,
  ) {
    const row = await this.opportunity(actor, id);
    if (["WON", "LOST"].includes(row.stage))
      throw new BadRequestException(
        "Closed opportunities cannot run a follow-up sequence",
      );
    if (input.enabled && (!row.ownerId || row.nextFollowUpAt))
      throw new BadRequestException(
        "Assign an owner and finish or clear the existing follow-up before starting a sequence",
      );
    if (!input.enabled && row.followUpSequenceStep === null)
      throw new BadRequestException("No sequence is active");
    const now = new Date();
    const data = {
      followUpSequenceStartedAt: input.enabled ? now : null,
      followUpSequenceStep: input.enabled ? 0 : null,
      nextFollowUpAt: input.enabled
        ? new Date(now.getTime() + 86_400_000)
        : null,
    };
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.salesOpportunity.updateMany({
        where: { id: row.id, version: input.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException(
          "Opportunity changed; refresh and try again",
        );
      const summary = input.enabled
        ? "24-hour / 3-day / 7-day follow-up sequence started; in-app reminders only"
        : "Follow-up sequence stopped";
      await tx.salesActivity.create({
        data: {
          tenantId: actor.tenantId,
          opportunityId: row.id,
          actorUserId: actor.userId,
          type: "UPDATED",
          summary,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          resourceType: "sales-opportunity",
          resourcePublicId: id,
          action: "crm.follow-up-sequence.updated",
          afterJson: JSON.stringify(data),
        },
      });
      return { ...data, version: input.version + 1 };
    });
  }
}

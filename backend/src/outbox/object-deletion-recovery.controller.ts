import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { ObjectDeletionRecoveryService } from "./object-deletion-recovery.service";

class FailedDeletionQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

@Controller("outbox/object-deletions")
@RequirePermissions(Permission.SettingsManage)
@RequireRoles("PLATFORM_ADMIN")
export class ObjectDeletionRecoveryController {
  constructor(private readonly recovery: ObjectDeletionRecoveryService) {}

  @Get("failed")
  listFailed(@CurrentActor() actor: Actor, @Query() query: FailedDeletionQueryDto) {
    return this.recovery.listFailed(actor, query);
  }

  @Post(":eventId/requeue")
  requeue(@CurrentActor() actor: Actor, @Param("eventId") eventId: string) {
    return this.recovery.requeue(actor, eventId);
  }
}

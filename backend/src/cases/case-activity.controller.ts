import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import type { Actor } from "../common/auth/actor";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import { Permission } from "../common/auth/permissions";
import { CaseActivityService } from "./case-activity.service";

export class CaseActivityQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 15;

  @IsOptional()
  @IsIn(["case", "document", "report", "task", "field_visit", "invoice"])
  resource?: string;
}

@Controller("cases")
export class CaseActivityController {
  constructor(private readonly activity: CaseActivityService) {}

  @Get(":caseId/activity")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  @RequirePermissions(Permission.CaseRead)
  list(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Query() query: CaseActivityQueryDto,
  ) {
    return this.activity.list(actor, caseId, query);
  }
}

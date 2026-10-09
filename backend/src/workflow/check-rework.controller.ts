import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import {
  CheckReworkService,
  type AnnexurePeriod,
  type ReworkMode,
} from "./check-rework.service";

export class UtvQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(5) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(80) search?: string;
}

export class ReworkDto {
  @IsIn(["REOPEN", "REINITIATE", "REJECT"]) mode!: ReworkMode;
  @IsString() @Length(10, 500) reason!: string;
}

export class AnnexureQueryDto {
  @IsIn(["week", "month", "year"]) period: AnnexurePeriod = "month";
}

export class AnnexureExportQueryDto extends AnnexureQueryDto {
  /** Comma-separated column keys in the order wanted; all columns when absent. */
  @IsOptional() @IsString() @MaxLength(300) columns?: string;
}

/** UTV bucket, Team Leader send-back and the team annexure. */
@Controller("workflow")
export class CheckReworkController {
  constructor(private readonly rework: CheckReworkService) {}

  @Get("utv")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.CaseRead)
  utv(@CurrentActor() actor: Actor, @Query() query: UtvQueryDto) {
    return this.rework.utvBucket(actor, query);
  }

  @Post("checks/:checkId/rework")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.CaseRead)
  send(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Body() input: ReworkDto,
  ) {
    return this.rework.rework(actor, checkId, input.mode, input.reason);
  }

  @Get("team-annexure")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.CaseRead)
  annexure(@CurrentActor() actor: Actor, @Query() query: AnnexureQueryDto) {
    return this.rework.annexure(actor, query.period);
  }

  @Get("team-annexure/export")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.CaseRead)
  annexureExport(
    @CurrentActor() actor: Actor,
    @Query() query: AnnexureExportQueryDto,
  ) {
    return this.rework.annexureCsv(actor, query.period, query.columns);
  }
}

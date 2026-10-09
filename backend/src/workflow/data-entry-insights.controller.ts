import { Controller, Get, Query } from "@nestjs/common";
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { DataEntryInsightsService } from "./data-entry-insights.service";

export class DataEntryScopeDto {
  @IsOptional() @IsIn(["mine", "team"]) scope?: "mine" | "team";
}

export class DataEntryReportQueryDto extends DataEntryScopeDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(300) columns?: string;
}

/** Data Entry overview numbers and the custom report (read-only). */
@Controller("workflow/data-entry")
@RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "DATA_ENTRY")
export class DataEntryInsightsController {
  constructor(private readonly insights: DataEntryInsightsService) {}

  @Get("overview")
  overview(@CurrentActor() actor: Actor, @Query() query: DataEntryScopeDto) {
    return this.insights.overview(actor, query.scope);
  }

  @Get("report")
  report(
    @CurrentActor() actor: Actor,
    @Query() query: DataEntryReportQueryDto,
  ) {
    return this.insights.report(actor, query);
  }

  @Get("report/export")
  export(
    @CurrentActor() actor: Actor,
    @Query() query: DataEntryReportQueryDto,
  ) {
    return this.insights.exportCsv(actor, query);
  }
}

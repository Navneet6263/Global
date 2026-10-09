import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
} from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import type { Disposition } from "../verification/dispositions";
import {
  MIS_FREQUENCIES,
  MIS_PRESETS,
  type MisFrequency,
  type MisPreset,
} from "./client-mis";
import { ClientReportsService } from "./client-reports.service";

export class MisQueryDto {
  @IsIn(MIS_PRESETS) preset: MisPreset = "CASE_STATUS";
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class BulkReportsQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional()
  @IsIn(["GREEN", "RED", "YELLOW", "AMBER", "BLUE", "CLIENT_REVIEW"])
  colour?: Disposition;
}

export class MisScheduleDto {
  @IsIn(MIS_PRESETS) preset!: MisPreset;
  @IsIn(MIS_FREQUENCIES) frequency!: MisFrequency;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsEmail({}, { each: true })
  recipients!: string[];
}

/** Company Admin: preset MIS, bulk report download and scheduled MIS. */
@Controller("client-reports")
export class ClientReportsController {
  constructor(private readonly reports: ClientReportsService) {}

  @Get("mis")
  @RequireRoles("CLIENT_ADMIN")
  @RequirePermissions(Permission.CaseRead)
  mis(@CurrentActor() actor: Actor, @Query() query: MisQueryDto) {
    return this.reports.mis(actor, query.preset, query.from, query.to);
  }

  @Get("mis/export")
  @RequireRoles("CLIENT_ADMIN")
  @RequirePermissions(Permission.CaseRead)
  misExport(@CurrentActor() actor: Actor, @Query() query: MisQueryDto) {
    return this.reports.misExport(actor, query.preset, query.from, query.to);
  }

  @Get("bulk")
  @RequireRoles("CLIENT_ADMIN")
  @RequirePermissions(Permission.ReportRead)
  bulk(@CurrentActor() actor: Actor, @Query() query: BulkReportsQueryDto) {
    return this.reports.bulk(actor, query.from, query.to, query.colour);
  }

  @Get("schedules")
  @RequireRoles("CLIENT_ADMIN")
  @RequirePermissions(Permission.CaseRead)
  schedules(@CurrentActor() actor: Actor) {
    return this.reports.schedules(actor);
  }

  @Post("schedules")
  @RequireRoles("CLIENT_ADMIN")
  @RequirePermissions(Permission.CaseRead)
  schedule(@CurrentActor() actor: Actor, @Body() input: MisScheduleDto) {
    return this.reports.schedule(actor, input);
  }

  @Delete("schedules/:scheduleId")
  @RequireRoles("CLIENT_ADMIN")
  @RequirePermissions(Permission.CaseRead)
  unschedule(
    @CurrentActor() actor: Actor,
    @Param("scheduleId", ParseUUIDPipe) scheduleId: string,
  ) {
    return this.reports.unschedule(actor, scheduleId);
  }
}

import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Length,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { AuditService } from "./audit.service";

class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 15;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() actor?: string;
  @IsOptional() @IsString() resourceType?: string;
  @IsOptional()
  @IsIn(["access", "case", "client", "document", "policy", "report", "finance"])
  category?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export const EXPORT_SOURCES = [
  "data-entry-queue",
  "team-queue",
  "team-members",
  "verifier-tasks",
  "verifier-sla",
  "verifier-blockers",
  "verifier-history",
  "utv",
  "team-annexure",
  "qa-queue",
  "qa-mine",
  "qa-corrections",
  "qa-history",
] as const;

export class ExportLogDto {
  @IsIn(EXPORT_SOURCES) source!: (typeof EXPORT_SOURCES)[number];
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000) rows!: number;
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  columns!: string[];
}

@Controller("audit-events")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AuditRead)
  @RequireRoles("PLATFORM_ADMIN")
  list(@CurrentActor() actor: Actor, @Query() query: AuditQueryDto) {
    return this.audit.list(actor, query);
  }

  @Get("facets")
  @RequirePermissions(Permission.AuditRead)
  @RequireRoles("PLATFORM_ADMIN")
  facets(@CurrentActor() actor: Actor) {
    return this.audit.facets(actor);
  }

  /** A sheet exported in the browser from a work list: who, which list, how many rows, which columns. */
  @Post("exports")
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "VERIFIER",
    "QA_REVIEWER",
    "DATA_ENTRY",
  )
  logExport(@CurrentActor() actor: Actor, @Body() input: ExportLogDto) {
    return this.audit.logExport(actor, input);
  }
}

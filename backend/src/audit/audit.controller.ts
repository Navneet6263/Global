import { Controller, Get, Query } from "@nestjs/common";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
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
}

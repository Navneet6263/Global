import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from "@nestjs/common";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject } from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { VerifiedDetailsService } from "./verified-details.service";

export class VerifiedDetailsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsObject({ each: true })
  entries!: Array<Record<string, unknown>>;
}

/** LHS (Data Entry) vs RHS (what the source confirmed) for one check. */
@Controller("checks/:checkId/verified-details")
export class VerifiedDetailsController {
  constructor(private readonly details: VerifiedDetailsService) {}

  @Get()
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER", "QA_REVIEWER")
  @RequirePermissions(Permission.CaseRead)
  get(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
  ) {
    return this.details.get(actor, checkId);
  }

  @Put()
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.TaskWrite)
  save(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Body() input: VerifiedDetailsDto,
  ) {
    return this.details.save(actor, checkId, input.entries);
  }
}

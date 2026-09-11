import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { SourceOutreachDto, OutreachQueryDto } from "./dto/source-outreach.dto";
import { SourceOutreachService } from "./source-outreach.service";

@Controller("checks/:checkId/methods/:methodId/outreach")
export class SourceOutreachController {
  constructor(private readonly service: SourceOutreachService) {}
  @Get()
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER", "QA_REVIEWER")
  @RequirePermissions(Permission.CaseRead)
  list(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Param("methodId", ParseUUIDPipe) methodId: string,
    @Query() query: OutreachQueryDto,
  ) {
    return this.service.list(actor, checkId, methodId, query);
  }
  @Post()
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.TaskWrite)
  record(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Param("methodId", ParseUUIDPipe) methodId: string,
    @Body() input: SourceOutreachDto,
  ) {
    return this.service.record(actor, checkId, methodId, input);
  }
}

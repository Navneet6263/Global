import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { VerificationMethodsService } from "./verification-methods.service";
import {
  CreateVerificationMethodDto,
  RespondVerificationMethodDto,
} from "./dto/verification-method.dto";

@Controller("checks/:checkId/methods")
export class VerificationMethodsController {
  constructor(private readonly methods: VerificationMethodsService) {}
  @Get()
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER", "QA_REVIEWER")
  @RequirePermissions(Permission.CaseRead)
  list(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
  ) {
    return this.methods.list(actor, checkId);
  }

  @Post()
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.TaskWrite)
  create(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Body() input: CreateVerificationMethodDto,
  ) {
    return this.methods.create(actor, checkId, input);
  }

  @Patch(":methodId")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.TaskWrite)
  respond(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Param("methodId", ParseUUIDPipe) methodId: string,
    @Body() input: RespondVerificationMethodDto,
  ) {
    return this.methods.respond(actor, checkId, methodId, input);
  }
}

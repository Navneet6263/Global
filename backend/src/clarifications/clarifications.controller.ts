import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentActor,
  Public,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { ClarificationsService } from "./clarifications.service";
import { CreateClarificationDto } from "./dto/create-clarification.dto";
import { RespondClarificationDto } from "./dto/respond-clarification.dto";
import { ResolveClarificationDto } from "./dto/resolve-clarification.dto";
import { ClientClarificationResponseService } from "./client-clarification-response.service";

@Controller()
export class ClarificationsController {
  constructor(
    private readonly clarifications: ClarificationsService,
    private readonly clientResponses: ClientClarificationResponseService,
  ) {}

  @Get("cases/:caseId/clarifications")
  @RequirePermissions(Permission.ClarificationRead)
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "CLIENT_ADMIN",
    "VERIFIER",
    "QA_REVIEWER",
  )
  list(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.clarifications.listForCase(actor, caseId);
  }

  @Post("cases/:caseId/clarifications")
  @RequirePermissions(Permission.ClarificationWrite)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  create(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: CreateClarificationDto,
  ) {
    return this.clarifications.create(actor, caseId, input);
  }

  @Patch("cases/:caseId/clarifications/:clarificationId/resolve")
  @RequirePermissions(Permission.ClarificationWrite)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  resolve(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("clarificationId", ParseUUIDPipe) clarificationId: string,
    @Body() input: ResolveClarificationDto,
  ) {
    return this.clarifications.resolve(
      actor,
      caseId,
      clarificationId,
      input.note,
    );
  }

  @Post("cases/:caseId/clarifications/:clarificationId/respond")
  @RequirePermissions(Permission.ClarificationRead)
  @RequireRoles("CLIENT_ADMIN")
  respondAsClient(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("clarificationId", ParseUUIDPipe) clarificationId: string,
    @Body() input: RespondClarificationDto,
  ) {
    return this.clientResponses.respond(
      actor,
      caseId,
      clarificationId,
      input.message,
    );
  }

  @Get("public/clarifications/:clarificationId")
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  getPublic(
    @Param("clarificationId", ParseUUIDPipe) clarificationId: string,
    @Headers("x-portal-token") token: string,
  ) {
    return this.clarifications.getPublic(clarificationId, token ?? "");
  }

  @Post("public/clarifications/:clarificationId/respond")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  respond(
    @Param("clarificationId", ParseUUIDPipe) clarificationId: string,
    @Headers("x-portal-token") token: string,
    @Body() input: RespondClarificationDto,
  ) {
    return this.clarifications.respond(
      clarificationId,
      token ?? "",
      input.message,
    );
  }
}

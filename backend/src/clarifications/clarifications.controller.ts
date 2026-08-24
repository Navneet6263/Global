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
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { ClarificationsService } from "./clarifications.service";
import { CreateClarificationDto } from "./dto/create-clarification.dto";
import { RespondClarificationDto } from "./dto/respond-clarification.dto";
import { ResolveClarificationDto } from "./dto/resolve-clarification.dto";

@Controller()
export class ClarificationsController {
  constructor(private readonly clarifications: ClarificationsService) {}

  @Get("cases/:caseId/clarifications")
  @RequirePermissions(Permission.ClarificationRead)
  list(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.clarifications.listForCase(actor, caseId);
  }

  @Post("cases/:caseId/clarifications")
  @RequirePermissions(Permission.ClarificationWrite)
  create(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: CreateClarificationDto,
  ) {
    return this.clarifications.create(actor, caseId, input);
  }

  @Patch("cases/:caseId/clarifications/:clarificationId/resolve")
  @RequirePermissions(Permission.ClarificationWrite)
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

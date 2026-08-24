import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";
import {
  CurrentActor,
  Public,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { ConsentsService } from "./consents.service";
import { ConfirmConsentDto } from "./dto/confirm-consent.dto";

@Controller()
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Get("public/consents/:consentId")
  @Public()
  getPublic(@Param("consentId", ParseUUIDPipe) consentId: string) {
    return this.consents.getPublic(consentId);
  }

  @Post("public/consents/:consentId/confirm")
  @Public()
  @Throttle({ default: { limit: 6, ttl: 10 * 60_000 } })
  confirm(
    @Param("consentId", ParseUUIDPipe) consentId: string,
    @Body() input: ConfirmConsentDto,
    @Req() request: FastifyRequest,
  ) {
    return this.consents.confirm(
      consentId,
      input.otp,
      request.ip,
      request.headers["user-agent"],
    );
  }

  @Post("cases/:caseId/consent/request")
  @RequirePermissions(Permission.ConsentManage)
  request(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.consents.request(actor, caseId);
  }
}

import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";
import {
  CurrentActor,
  Public,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { withUploadedBinary } from "../common/http/upload-capacity";
import { RespondClarificationDto } from "../clarifications/dto/respond-clarification.dto";
import { CandidatePortalService } from "./candidate-portal.service";

@Controller()
export class CandidatePortalController {
  constructor(
    private readonly portal: CandidatePortalService,
    private readonly config: ConfigService,
  ) {}

  @Post("cases/:caseId/candidate-access")
  @RequirePermissions(Permission.CaseCreate)
  issue(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.portal.issue(actor, caseId);
  }

  @Get("public/candidate-access/:accessId")
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  get(
    @Param("accessId", ParseUUIDPipe) accessId: string,
    @Headers("x-portal-token") token: string,
  ) {
    return this.portal.get(accessId, token ?? "");
  }

  @Post("public/candidate-access/:accessId/documents")
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async upload(
    @Param("accessId", ParseUUIDPipe) accessId: string,
    @Headers("x-portal-token") token: string,
    @Headers("x-document-type") type: string,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `public:${request.ip}`,
      (file) => this.portal.upload(accessId, token ?? "", type ?? "", file),
    );
  }

  @Post(
    "public/candidate-access/:accessId/clarifications/:clarificationId/respond",
  )
  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  respond(
    @Param("accessId", ParseUUIDPipe) accessId: string,
    @Param("clarificationId", ParseUUIDPipe) clarificationId: string,
    @Headers("x-portal-token") token: string,
    @Body() input: RespondClarificationDto,
  ) {
    return this.portal.respondToClarification(
      accessId,
      token ?? "",
      clarificationId,
      input.message,
    );
  }
}

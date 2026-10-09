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
import { SUPPORT_ROUTES } from "../support/support.routes";
import { RaiseSupportRequestDto } from "../support/support.validation";
import { ConfirmConsentDto } from "../consents/dto/confirm-consent.dto";
import { CandidateConsentService } from "./candidate-consent.service";
import { CandidatePortalService } from "./candidate-portal.service";
import { CandidateSupportService } from "./candidate-support.service";
import { IssueCandidateAccessDto } from "./issue-candidate-access.dto";

@Controller()
export class CandidatePortalController {
  constructor(
    private readonly portal: CandidatePortalService,
    private readonly support: CandidateSupportService,
    private readonly config: ConfigService,
    private readonly consent: CandidateConsentService,
  ) {}

  @Post("cases/:caseId/candidate-access")
  @RequirePermissions(Permission.CaseCreate)
  issue(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: IssueCandidateAccessDto,
  ) {
    return this.portal.issue(actor, caseId, input?.sendNotification ?? true);
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

  /** Consent inside the same link: email a one-time code (no separate consent link). */
  @Post("public/candidate-access/:accessId/consent/otp")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  sendConsentOtp(
    @Param("accessId", ParseUUIDPipe) accessId: string,
    @Headers("x-portal-token") token: string,
  ) {
    return this.consent.sendOtp(accessId, token ?? "");
  }

  @Post("public/candidate-access/:accessId/consent/confirm")
  @Public()
  @Throttle({ default: { limit: 6, ttl: 10 * 60_000 } })
  confirmConsent(
    @Param("accessId", ParseUUIDPipe) accessId: string,
    @Headers("x-portal-token") token: string,
    @Body() input: ConfirmConsentDto,
    @Req() request: FastifyRequest,
  ) {
    return this.consent.confirm(
      accessId,
      token ?? "",
      input.otp,
      request.ip,
      request.headers["user-agent"],
    );
  }

  @Post("public/candidate-access/:accessId/documents")
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async upload(
    @Param("accessId", ParseUUIDPipe) accessId: string,
    @Headers("x-portal-token") token: string,
    @Headers("x-document-type") type: string,
    @Headers("x-document-expires-at") expiry: string,
    @Headers("x-privacy-notice-version") noticeVersion: string,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `public:${request.ip}`,
      (file) =>
        this.portal.upload(
          accessId,
          token ?? "",
          type ?? "",
          file,
          expiry,
          noticeVersion,
        ),
    );
  }

  /** "I have uploaded all documents": closes this link once everything requested is in. */
  @Post("public/candidate-access/:accessId/complete")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  complete(
    @Param("accessId", ParseUUIDPipe) accessId: string,
    @Headers("x-portal-token") token: string,
  ) {
    return this.portal.complete(accessId, token ?? "");
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

  @Post(SUPPORT_ROUTES.candidateRequests)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  raiseSupportRequest(
    @Param("accessId", ParseUUIDPipe) accessId: string,
    @Headers("x-portal-token") token: string,
    @Body() input: RaiseSupportRequestDto,
  ) {
    return this.support.raise(accessId, token ?? "", input);
  }
}

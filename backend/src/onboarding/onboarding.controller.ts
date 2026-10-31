import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyRequest } from "fastify";
import {
  AllowViewOnlyAdmin,
  CurrentActor,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { withUploadedBinary } from "../common/http/upload-capacity";
import {
  CompanyDocumentParamsDto,
  OnboardingActivityQueryDto,
  OnboardingCommercialDto,
  OnboardingCompanyDto,
  OnboardingDecisionDto,
  OnboardingDocumentParamsDto,
  OnboardingMessageDto,
  OnboardingQueryDto,
  OnboardingRejectDto,
  OnboardingReviewDto,
  OnboardingSubmitDto,
  OnboardingUploadQueryDto,
} from "./dto/onboarding.dto";
import { OnboardingService } from "./onboarding.service";

/** The signed-up company admin completes its own onboarding checklist. */
@Controller("onboarding/me")
@RequireRoles("CLIENT_ADMIN")
export class ClientOnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  mine(@CurrentActor() actor: Actor) {
    return this.onboarding.mine(actor);
  }

  @Patch("company")
  updateCompany(
    @CurrentActor() actor: Actor,
    @Body() input: OnboardingCompanyDto,
  ) {
    return this.onboarding.updateCompany(actor, input);
  }

  @Post("documents/:type")
  upload(
    @CurrentActor() actor: Actor,
    @Param() params: OnboardingDocumentParamsDto,
    @Query() query: OnboardingUploadQueryDto,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `${actor.tenantPublicId}:${actor.userPublicId}`,
      (file) =>
        this.onboarding.uploadDocument(
          actor,
          params.type,
          query.signedOn,
          file,
        ),
    );
  }

  @Get("documents/:agreementId/files/:fileId")
  @Header("Cache-Control", "private, no-store")
  download(
    @CurrentActor() actor: Actor,
    @Param("agreementId", ParseUUIDPipe) agreementId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return this.onboarding.downloadOwn(actor, agreementId, fileId);
  }

  @Post("submit")
  submit(@CurrentActor() actor: Actor, @Body() input: OnboardingSubmitDto) {
    return this.onboarding.submit(actor, input);
  }
}

/**
 * Every company's onboarding. Operations or the assigned RM review and approve; Platform
 * Admin may also set a company up (details, documents, packages) but never approves.
 */
@Controller("onboarding/companies")
@RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM")
export class OpsOnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: OnboardingQueryDto) {
    return this.onboarding.list(actor, query);
  }

  @Get(":clientId")
  detail(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
  ) {
    return this.onboarding.detail(actor, clientId);
  }

  /** The company's activity, newest first, one page at a time. */
  @Get(":clientId/activity")
  activity(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Query() query: OnboardingActivityQueryDto,
  ) {
    return this.onboarding.activity(actor, clientId, query);
  }

  @Get(":clientId/documents/:agreementId/files/:fileId")
  @Header("Cache-Control", "private, no-store")
  download(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Param("agreementId", ParseUUIDPipe) agreementId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return this.onboarding.download(actor, clientId, agreementId, fileId);
  }

  @Post(":clientId/documents/:agreementId/files/:fileId/review")
  review(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Param("agreementId", ParseUUIDPipe) agreementId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
    @Body() input: OnboardingReviewDto,
  ) {
    return this.onboarding.review(actor, clientId, agreementId, fileId, input);
  }

  @Patch(":clientId/company")
  @AllowViewOnlyAdmin()
  updateCompany(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: OnboardingCompanyDto,
  ) {
    return this.onboarding.updateCompanyDetails(actor, clientId, input);
  }

  @Post(":clientId/documents/:type")
  @AllowViewOnlyAdmin()
  uploadDocument(
    @CurrentActor() actor: Actor,
    @Param() params: CompanyDocumentParamsDto,
    @Query() query: OnboardingUploadQueryDto,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `${actor.tenantPublicId}:${actor.userPublicId}`,
      (file) =>
        this.onboarding.uploadCompanyDocument(
          actor,
          params.clientId,
          params.type,
          query.signedOn,
          file,
        ),
    );
  }

  @Put(":clientId/commercial")
  @AllowViewOnlyAdmin()
  commercial(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: OnboardingCommercialDto,
  ) {
    return this.onboarding.updateCommercial(actor, clientId, input);
  }

  @Post(":clientId/message")
  message(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: OnboardingMessageDto,
  ) {
    return this.onboarding.message(actor, clientId, input);
  }

  @Post(":clientId/activate")
  activate(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: OnboardingDecisionDto,
  ) {
    return this.onboarding.activate(actor, clientId, input);
  }

  @Post(":clientId/reject")
  reject(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: OnboardingRejectDto,
  ) {
    return this.onboarding.reject(actor, clientId, input);
  }
}

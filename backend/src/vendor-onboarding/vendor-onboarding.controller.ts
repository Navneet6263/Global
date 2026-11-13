import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyRequest } from "fastify";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { withUploadedBinary } from "../common/http/upload-capacity";
import {
  VendorDocumentUploadQueryDto,
  VendorProfileUpdateDto,
} from "./dto/vendor-onboarding.dto";
import { VendorOnboardingService } from "./vendor-onboarding.service";

/**
 * Vendor onboarding workspace: allows newly registered vendors to inspect their
 * verification status, upload required business documents, and submit for Operations review.
 */
@Controller("vendor/onboarding/me")
@RequireRoles("VENDOR")
export class VendorOnboardingController {
  constructor(
    private readonly onboarding: VendorOnboardingService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  mine(@CurrentActor() actor: Actor) {
    return this.onboarding.mine(actor);
  }

  @Get("document/:docId/download")
  @Header("Cache-Control", "private, no-store")
  download(
    @CurrentActor() actor: Actor,
    @Param("docId", ParseUUIDPipe) docId: string,
  ) {
    return this.onboarding.downloadOwnDocument(actor, docId);
  }

  @Post("document")
  uploadDocument(
    @CurrentActor() actor: Actor,
    @Query() query: VendorDocumentUploadQueryDto,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `${actor.tenantPublicId}:${actor.userPublicId}`,
      (file) => this.onboarding.uploadDocument(actor, query.documentType, file),
    );
  }

  @Post("submit")
  submit(@CurrentActor() actor: Actor) {
    return this.onboarding.submit(actor);
  }

  @Patch("profile")
  updateProfile(
    @CurrentActor() actor: Actor,
    @Body() input: VendorProfileUpdateDto,
  ) {
    return this.onboarding.updateProfile(actor, input);
  }
}

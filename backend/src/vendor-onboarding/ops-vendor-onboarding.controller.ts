import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import {
  VendorDocumentReviewDto,
  VendorOnboardingQueryDto,
  VendorRejectDto,
} from "./dto/vendor-onboarding.dto";
import { VendorOnboardingOpsService } from "./vendor-onboarding-ops.service";

/**
 * Operations portal: review and verify vendor self-signup profiles and submitted business documents.
 */
@Controller("operations/vendor-onboarding")
@RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
export class OpsVendorOnboardingController {
  constructor(private readonly opsService: VendorOnboardingOpsService) {}

  @Get()
  list(
    @CurrentActor() actor: Actor,
    @Query() query: VendorOnboardingQueryDto,
  ) {
    return this.opsService.listForOperations(actor, query);
  }

  @Get(":vendorProfileId")
  detail(
    @CurrentActor() actor: Actor,
    @Param("vendorProfileId", ParseUUIDPipe) vendorProfileId: string,
  ) {
    return this.opsService.detailForOperations(actor, vendorProfileId);
  }

  @Get(":vendorProfileId/documents/:docId/download")
  @Header("Cache-Control", "private, no-store")
  download(
    @CurrentActor() actor: Actor,
    @Param("vendorProfileId", ParseUUIDPipe) vendorProfileId: string,
    @Param("docId", ParseUUIDPipe) docId: string,
  ) {
    return this.opsService.downloadDocForOperations(actor, vendorProfileId, docId);
  }

  @Post(":vendorProfileId/documents/:docId/review")
  reviewDocument(
    @CurrentActor() actor: Actor,
    @Param("vendorProfileId", ParseUUIDPipe) vendorProfileId: string,
    @Param("docId", ParseUUIDPipe) docId: string,
    @Body() input: VendorDocumentReviewDto,
  ) {
    return this.opsService.reviewDocument(actor, vendorProfileId, docId, input);
  }

  @Post(":vendorProfileId/approve")
  approve(
    @CurrentActor() actor: Actor,
    @Param("vendorProfileId", ParseUUIDPipe) vendorProfileId: string,
  ) {
    return this.opsService.approveVendor(actor, vendorProfileId);
  }

  @Post(":vendorProfileId/reject")
  reject(
    @CurrentActor() actor: Actor,
    @Param("vendorProfileId", ParseUUIDPipe) vendorProfileId: string,
    @Body() input: VendorRejectDto,
  ) {
    return this.opsService.rejectVendor(actor, vendorProfileId, input);
  }
}

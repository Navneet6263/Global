import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { VENDOR_ROLES } from "../common/auth/roles";
import { withUploadedBinary } from "../common/http/upload-capacity";
import { UploadVendorReportService } from "./services/upload-vendor-report.service";
import { VendorReportFileService } from "./services/vendor-report-file.service";
import { VENDOR_REQUEST_ROUTES } from "./vendor-requests.routes";
import { ReportModeQueryDto } from "./vendor-requests.validation";

/**
 * Vendor reports on the caller's own requests (a team user: only delegated ones).
 * Upload after approval: PDF or PNG, at most 2 MB, checked on the server.
 */
@Controller(VENDOR_REQUEST_ROUTES.base)
@RequireRoles(...VENDOR_ROLES)
@RequirePermissions(Permission.VendorReview)
export class VendorReportsController {
  constructor(
    private readonly uploads: UploadVendorReportService,
    private readonly files: VendorReportFileService,
    private readonly config: ConfigService,
  ) {}

  @Post(VENDOR_REQUEST_ROUTES.report)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  upload(
    @CurrentActor() actor: Actor,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `vendor:${actor.userPublicId}`,
      (file) => this.uploads.upload(actor, requestId, file),
    );
  }

  @Get(VENDOR_REQUEST_ROUTES.report)
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  report(
    @CurrentActor() actor: Actor,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Query() query: ReportModeQueryDto,
  ): Promise<StreamableFile> {
    return this.files.forVendor(actor, requestId, query.mode);
  }
}

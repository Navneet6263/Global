import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { VENDOR_ROLES } from "../common/auth/roles";
import { DecideVendorRequestService } from "./services/decide-vendor-request.service";
import { DelegateVendorRequestService } from "./services/delegate-vendor-request.service";
import { VendorInboxService } from "./services/vendor-inbox.service";
import { VENDOR_REQUEST_ROUTES } from "./vendor-requests.routes";
import {
  DelegateVendorRequestDto,
  VendorDecisionDto,
  VendorRequestQueryDto,
} from "./vendor-requests.validation";

/**
 * The Vendor workspace API: the caller's own requests (a team user: only those
 * delegated to it), plus the Main Vendor's delegate and remind actions.
 */
@Controller(VENDOR_REQUEST_ROUTES.base)
@RequireRoles(...VENDOR_ROLES)
@RequirePermissions(Permission.VendorReview)
export class VendorRequestsController {
  constructor(
    private readonly inbox: VendorInboxService,
    private readonly decisions: DecideVendorRequestService,
    private readonly delegation: DelegateVendorRequestService,
  ) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: VendorRequestQueryDto) {
    return this.inbox.list(actor, query);
  }

  @Get(VENDOR_REQUEST_ROUTES.request)
  detail(
    @CurrentActor() actor: Actor,
    @Param("requestId", ParseUUIDPipe) requestId: string,
  ) {
    return this.inbox.detail(actor, requestId);
  }

  @Get(VENDOR_REQUEST_ROUTES.preview)
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async preview(
    @CurrentActor() actor: Actor,
    @Param("requestId", ParseUUIDPipe) requestId: string,
  ): Promise<StreamableFile> {
    return (await this.inbox.preview(actor, requestId)).file;
  }

  @Post(VENDOR_REQUEST_ROUTES.decision)
  decide(
    @CurrentActor() actor: Actor,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() input: VendorDecisionDto,
  ) {
    return this.decisions.decide(actor, requestId, input);
  }

  @Post(VENDOR_REQUEST_ROUTES.delegate)
  delegate(
    @CurrentActor() actor: Actor,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() input: DelegateVendorRequestDto,
  ) {
    return this.delegation.delegate(actor, requestId, input);
  }

  @Post(VENDOR_REQUEST_ROUTES.remind)
  remind(
    @CurrentActor() actor: Actor,
    @Param("requestId", ParseUUIDPipe) requestId: string,
  ) {
    return this.delegation.remind(actor, requestId);
  }
}

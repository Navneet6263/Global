import { Controller, Get, Query } from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { VENDOR_ROLES } from "../common/auth/roles";
import { VendorActivityService } from "./services/vendor-activity.service";
import { VENDOR_LOG_ROUTES } from "./vendor-requests.routes";
import { VendorLogQueryDto } from "./vendor-requests.validation";

/** Vendor Logs (/vendor/logs): the caller's vendor account activity only. */
@Controller(VENDOR_LOG_ROUTES.base)
@RequireRoles(...VENDOR_ROLES)
@RequirePermissions(Permission.VendorReview)
export class VendorActivityController {
  constructor(private readonly activity: VendorActivityService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: VendorLogQueryDto) {
    return this.activity.list(actor, query);
  }
}

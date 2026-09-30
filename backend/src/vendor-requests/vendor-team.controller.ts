import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { VENDOR_ROLES } from "../common/auth/roles";
import { ResetUserPasswordDto } from "../users/dto/reset-user-password.dto";
import { CreateVendorTeamUserService } from "./services/create-vendor-team-user.service";
import { ManageVendorTeamUserService } from "./services/manage-vendor-team-user.service";
import { VendorTeamService } from "./services/vendor-team.service";
import { VENDOR_TEAM_ROUTES } from "./vendor-requests.routes";
import {
  CreateVendorTeamUserDto,
  SetVendorTeamUserStatusDto,
} from "./vendor-requests.validation";

/**
 * Vendor team (/vendor/team). Same guard and permissions as the rest of the Vendor
 * workspace (no new permission); only the Main Vendor may change anything, which
 * the services enforce, together with the Admin-set ACTIVE team limit.
 */
@Controller(VENDOR_TEAM_ROUTES.base)
@RequireRoles(...VENDOR_ROLES)
@RequirePermissions(Permission.VendorReview)
export class VendorTeamController {
  constructor(
    private readonly team: VendorTeamService,
    private readonly creator: CreateVendorTeamUserService,
    private readonly manager: ManageVendorTeamUserService,
  ) {}

  @Get()
  overview(@CurrentActor() actor: Actor) {
    return this.team.overview(actor);
  }

  @Post(VENDOR_TEAM_ROUTES.users)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentActor() actor: Actor, @Body() input: CreateVendorTeamUserDto) {
    return this.creator.create(actor, input);
  }

  @Patch(VENDOR_TEAM_ROUTES.userStatus)
  setStatus(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: SetVendorTeamUserStatusDto,
  ) {
    return this.manager.setStatus(actor, userId, input);
  }

  @Post(VENDOR_TEAM_ROUTES.userPassword)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: ResetUserPasswordDto,
  ) {
    return this.manager.resetPassword(actor, userId, input.temporaryPassword);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { ResetUserPasswordDto } from "../users/dto/reset-user-password.dto";
import { RmClientProfileService } from "./rm-client-profile.service";

/**
 * A company's profile for its RM (My clients): details, numbers, packages and its
 * Client Admin logins, with a password reset for those logins only.
 */
@Controller("rm/clients/:clientId")
export class RmClientProfileController {
  constructor(private readonly profiles: RmClientProfileService) {}

  @Get("profile")
  @RequireRoles("SPOC_RM", "OPS_MANAGER", "PLATFORM_ADMIN")
  profile(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
  ) {
    return this.profiles.profile(actor, clientId);
  }

  @Post("users/:userId/reset-password")
  @RequireRoles("SPOC_RM")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resetClientAdminPassword(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: ResetUserPasswordDto,
  ) {
    return this.profiles.resetClientAdminPassword(
      actor,
      clientId,
      userId,
      input.temporaryPassword,
    );
  }
}

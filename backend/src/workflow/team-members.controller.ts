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
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { ResetUserPasswordDto } from "../users/dto/reset-user-password.dto";
import { UserIdentityDto } from "../users/dto/user-identity.dto";
import { TeamMembersService } from "./team-members.service";

export class CreateTeamMemberDto extends UserIdentityDto {
  @IsUUID() departmentId!: string;
  /** Narrowed access (a subset of the team role); omitted = full access. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  permissions?: string[];
}

export class SetTeamMemberStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED"]) status!: "ACTIVE" | "SUSPENDED";
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

/** Team Leader: the people in the teams it leads (create, suspend, reset password). */
@Controller("workflow/team/members")
@RequireRoles("VERIFIER", "DATA_ENTRY")
export class TeamMembersController {
  constructor(private readonly members: TeamMembersService) {}

  @Get()
  overview(@CurrentActor() actor: Actor) {
    return this.members.overview(actor);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentActor() actor: Actor, @Body() input: CreateTeamMemberDto) {
    return this.members.create(actor, input);
  }

  @Patch(":userId/status")
  setStatus(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: SetTeamMemberStatusDto,
  ) {
    return this.members.setStatus(actor, userId, input);
  }

  @Post(":userId/reset-password")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: ResetUserPasswordDto,
  ) {
    return this.members.resetPassword(actor, userId, input.temporaryPassword);
  }
}

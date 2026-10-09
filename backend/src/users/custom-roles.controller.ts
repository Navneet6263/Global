import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import {
  AllowViewOnlyAdmin,
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CUSTOM_ROLE_BASES, CustomRolesService } from "./custom-roles.service";

export class CreateCustomRoleDto {
  @IsString() @Length(3, 60) name!: string;
  @IsIn(CUSTOM_ROLE_BASES) baseRoleCode!: string;
  @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) permissions!: string[];
}

export class UpdateCustomRoleDto {
  @IsOptional() @IsString() @Length(3, 60) name?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  permissions?: string[];
}

export class AssignCustomRoleDto {
  @IsBoolean() assigned!: boolean;
}

// Role administration is the Platform Admin's own work, like user IDs.
@Controller("roles/custom")
@AllowViewOnlyAdmin()
@RequireRoles("PLATFORM_ADMIN")
@RequirePermissions(Permission.UserRead)
export class CustomRolesController {
  constructor(private readonly roles: CustomRolesService) {}

  @Get()
  list(@CurrentActor() actor: Actor) {
    return this.roles.list(actor);
  }

  @Post()
  @RequirePermissions(Permission.UserWrite)
  create(@CurrentActor() actor: Actor, @Body() input: CreateCustomRoleDto) {
    return this.roles.create(actor, input);
  }

  @Patch(":roleId")
  @RequirePermissions(Permission.UserWrite)
  update(
    @CurrentActor() actor: Actor,
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @Body() input: UpdateCustomRoleDto,
  ) {
    return this.roles.update(actor, roleId, input);
  }

  @Get(":roleId/members")
  members(
    @CurrentActor() actor: Actor,
    @Param("roleId", ParseUUIDPipe) roleId: string,
  ) {
    return this.roles.members(actor, roleId);
  }

  @Post(":roleId/members/:userId")
  @RequirePermissions(Permission.UserWrite)
  assign(
    @CurrentActor() actor: Actor,
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: AssignCustomRoleDto,
  ) {
    return this.roles.assign(actor, roleId, userId, input.assigned);
  }

  @Delete(":roleId")
  @RequirePermissions(Permission.UserWrite)
  remove(
    @CurrentActor() actor: Actor,
    @Param("roleId", ParseUUIDPipe) roleId: string,
  ) {
    return this.roles.remove(actor, roleId);
  }
}

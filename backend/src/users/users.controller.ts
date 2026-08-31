import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import { UserDirectoryQueryDto } from "./dto/user-directory-query.dto";
import { UserActivityQueryDto } from "./dto/user-activity-query.dto";

@Controller("users")
@RequirePermissions(Permission.UserRead)
@RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: UserDirectoryQueryDto) {
    return this.users.list(actor, query);
  }

  @Get("roles")
  @RequirePermissions(Permission.UserRead)
  roles(@CurrentActor() actor: Actor) {
    return this.users.roles(actor);
  }

  @Get(":userId/activity")
  @RequirePermissions(Permission.UserRead)
  activity(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query() query: UserActivityQueryDto,
  ) {
    return this.users.activity(actor, userId, query);
  }

  @Post()
  @RequireRoles("PLATFORM_ADMIN")
  @RequirePermissions(Permission.UserWrite)
  create(@CurrentActor() actor: Actor, @Body() input: CreateUserDto) {
    return this.users.create(actor, input);
  }

  @Patch(":userId")
  @RequireRoles("PLATFORM_ADMIN")
  @RequirePermissions(Permission.UserWrite)
  update(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: UpdateUserDto,
  ) {
    return this.users.update(actor, userId, input);
  }

  @Post(":userId/reset-password")
  @RequireRoles("PLATFORM_ADMIN")
  @RequirePermissions(Permission.UserWrite)
  resetPassword(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: ResetUserPasswordDto,
  ) {
    return this.users.resetPassword(actor, userId, input.temporaryPassword);
  }
}

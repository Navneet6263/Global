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
import { IsIn, IsOptional } from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";

class UserDirectoryQueryDto {
  @IsOptional()
  @IsIn([
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "VERIFIER",
    "QA_REVIEWER",
    "CLIENT_ADMIN",
    "FIELD_EXECUTIVE",
    "SALES_MANAGER",
    "FINANCE_MANAGER",
  ])
  role?: string;
}

@Controller("users")
@RequirePermissions(Permission.TaskWrite)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: UserDirectoryQueryDto) {
    return this.users.list(actor, query.role);
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
  ) {
    return this.users.activity(actor, userId);
  }

  @Post()
  @RequirePermissions(Permission.UserWrite)
  create(@CurrentActor() actor: Actor, @Body() input: CreateUserDto) {
    return this.users.create(actor, input);
  }

  @Patch(":userId")
  @RequirePermissions(Permission.UserWrite)
  update(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: UpdateUserDto,
  ) {
    return this.users.update(actor, userId, input);
  }

  @Post(":userId/reset-password")
  @RequirePermissions(Permission.UserWrite)
  resetPassword(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: ResetUserPasswordDto,
  ) {
    return this.users.resetPassword(actor, userId, input.temporaryPassword);
  }
}

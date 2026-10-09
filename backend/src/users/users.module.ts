import { CustomRolesController } from "./custom-roles.controller";
import { CustomRolesService } from "./custom-roles.service";
import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController, CustomRolesController],
  providers: [UsersService, CustomRolesService],
})
export class UsersModule {}

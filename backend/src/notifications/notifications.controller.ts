import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  AllowViewOnlyAdmin,
  CurrentActor,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import {
  NotificationCategories,
  type NotificationCategory,
} from "./notification-categories";
import { NotificationsService } from "./notifications.service";

export class NotificationQueryDto {
  @IsOptional() @IsUUID() cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  unread?: boolean;

  @IsOptional() @IsIn(NotificationCategories) category?: NotificationCategory;

  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

@Controller("notifications")
@RequirePermissions(Permission.NotificationRead)
@AllowViewOnlyAdmin()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() list(
    @CurrentActor() actor: Actor,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notifications.list(actor, query);
  }
  @Patch(":notificationId/read") markRead(
    @CurrentActor() actor: Actor,
    @Param("notificationId", ParseUUIDPipe) notificationId: string,
  ) {
    return this.notifications.markRead(actor, notificationId);
  }
  @Patch(":notificationId/unread") markUnread(
    @CurrentActor() actor: Actor,
    @Param("notificationId", ParseUUIDPipe) notificationId: string,
  ) {
    return this.notifications.markUnread(actor, notificationId);
  }
  @Post("read-all") markAllRead(@CurrentActor() actor: Actor) {
    return this.notifications.markAllRead(actor);
  }
}

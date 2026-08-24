import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@RequirePermissions(Permission.NotificationRead)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() list(@CurrentActor() actor: Actor) {
    return this.notifications.list(actor);
  }
  @Patch(":notificationId/read") markRead(
    @CurrentActor() actor: Actor,
    @Param("notificationId", ParseUUIDPipe) notificationId: string,
  ) {
    return this.notifications.markRead(actor, notificationId);
  }
  @Post("read-all") markAllRead(@CurrentActor() actor: Actor) {
    return this.notifications.markAllRead(actor);
  }
}

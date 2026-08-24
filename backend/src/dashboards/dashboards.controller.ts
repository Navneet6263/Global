import { Controller, Get } from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { DashboardsService } from "./dashboards.service";

@Controller("dashboards")
@RequirePermissions(Permission.DashboardRead)
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get("operations")
  operations(@CurrentActor() actor: Actor) {
    return this.dashboards.operations(actor);
  }

  @Get("executive")
  executive(@CurrentActor() actor: Actor) {
    return this.dashboards.executive(actor);
  }

  @Get("exceptions")
  exceptions(@CurrentActor() actor: Actor) {
    return this.dashboards.exceptions(actor);
  }
}

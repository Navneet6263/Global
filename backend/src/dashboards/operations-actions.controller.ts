import { Controller, Get, Query } from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { OperationsActionQueryDto } from "./dto/operations-action-query.dto";
import { OperationsActionsService } from "./operations-actions.service";

@Controller("dashboards/operations/actions")
@RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
@RequirePermissions(Permission.DashboardRead, Permission.CaseRead)
export class OperationsActionsController {
  constructor(private readonly actions: OperationsActionsService) {}

  @Get()
  get(@CurrentActor() actor: Actor, @Query() query: OperationsActionQueryDto) {
    return this.actions.get(actor, query);
  }
}

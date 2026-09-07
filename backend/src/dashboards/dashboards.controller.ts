import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  StreamableFile,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { DashboardClientService } from "./dashboard-client.service";
import { DashboardsService } from "./dashboards.service";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { ExecutiveExportService } from "./executive-export.service";
import {
  ExecutiveExportQueryDto,
  ExecutiveQueryDto,
  ExecutiveScheduleDto,
} from "./dto/executive-query.dto";
import { VerifierCapacityService } from "./verifier-capacity.service";
import { NavigationCountsService } from "./navigation-counts.service";

@Controller("dashboards")
@RequirePermissions(Permission.DashboardRead)
export class DashboardsController {
  constructor(
    private readonly dashboards: DashboardsService,
    private readonly clientDashboard: DashboardClientService,
    private readonly executiveAnalytics: ExecutiveAnalyticsService,
    private readonly executiveExport: ExecutiveExportService,
    private readonly verifierCapacity: VerifierCapacityService,
    private readonly navigationCounts: NavigationCountsService,
  ) {}

  @Get("navigation")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "CLIENT_ADMIN")
  navigation(@CurrentActor() actor: Actor) {
    return this.navigationCounts.get(actor);
  }

  @Get("operations")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "CLIENT_ADMIN")
  operations(@CurrentActor() actor: Actor) {
    return this.dashboards.operations(actor);
  }

  @Get("client")
  @RequireRoles("CLIENT_ADMIN")
  client(@CurrentActor() actor: Actor) {
    return this.clientDashboard.get(actor);
  }

  @Get("executive")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  executive(@CurrentActor() actor: Actor, @Query() query: ExecutiveQueryDto) {
    return this.executiveAnalytics.dashboard(actor, query);
  }

  @Get("executive/export")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  exportExecutive(
    @CurrentActor() actor: Actor,
    @Query() query: ExecutiveExportQueryDto,
  ): Promise<StreamableFile> {
    return this.executiveExport.export(actor, query);
  }

  @Post("executive/schedule")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  scheduleExecutive(
    @CurrentActor() actor: Actor,
    @Body() input: ExecutiveScheduleDto,
  ) {
    return this.executiveExport.schedule(actor, input);
  }

  @Get("exceptions")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "CLIENT_ADMIN")
  exceptions(@CurrentActor() actor: Actor) {
    return this.dashboards.exceptions(actor);
  }

  @Get("verifier-capacity")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  verifierCapacityDashboard(@CurrentActor() actor: Actor) {
    return this.verifierCapacity.get(actor);
  }
}

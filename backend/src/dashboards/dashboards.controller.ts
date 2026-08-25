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
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { DashboardsService } from "./dashboards.service";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { ExecutiveExportService } from "./executive-export.service";
import {
  ExecutiveExportQueryDto,
  ExecutiveQueryDto,
  ExecutiveScheduleDto,
} from "./dto/executive-query.dto";

@Controller("dashboards")
@RequirePermissions(Permission.DashboardRead)
export class DashboardsController {
  constructor(
    private readonly dashboards: DashboardsService,
    private readonly executiveAnalytics: ExecutiveAnalyticsService,
    private readonly executiveExport: ExecutiveExportService,
  ) {}

  @Get("operations")
  operations(@CurrentActor() actor: Actor) {
    return this.dashboards.operations(actor);
  }

  @Get("executive")
  executive(@CurrentActor() actor: Actor, @Query() query: ExecutiveQueryDto) {
    return this.executiveAnalytics.dashboard(actor, query);
  }

  @Get("executive/export")
  exportExecutive(
    @CurrentActor() actor: Actor,
    @Query() query: ExecutiveExportQueryDto,
  ): Promise<StreamableFile> {
    return this.executiveExport.export(actor, query);
  }

  @Post("executive/schedule")
  scheduleExecutive(
    @CurrentActor() actor: Actor,
    @Body() input: ExecutiveScheduleDto,
  ) {
    return this.executiveExport.schedule(actor, input);
  }

  @Get("exceptions")
  exceptions(@CurrentActor() actor: Actor) {
    return this.dashboards.exceptions(actor);
  }
}

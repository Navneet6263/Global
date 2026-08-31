import { Module } from "@nestjs/common";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";
import { DashboardExceptionsService } from "./dashboard-exceptions.service";
import { DashboardClientService } from "./dashboard-client.service";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { ExecutiveExportService } from "./executive-export.service";

@Module({
  controllers: [DashboardsController],
  providers: [
    DashboardsService,
    DashboardClientService,
    DashboardExceptionsService,
    ExecutiveAnalyticsService,
    ExecutiveExportService,
  ],
})
export class DashboardsModule {}

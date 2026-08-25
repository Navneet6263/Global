import { Module } from "@nestjs/common";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { ExecutiveExportService } from "./executive-export.service";

@Module({
  controllers: [DashboardsController],
  providers: [DashboardsService, ExecutiveAnalyticsService, ExecutiveExportService],
})
export class DashboardsModule {}

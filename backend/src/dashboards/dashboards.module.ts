import { Module } from "@nestjs/common";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";
import { DashboardExceptionsService } from "./dashboard-exceptions.service";
import { DashboardClientService } from "./dashboard-client.service";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { ExecutiveExportService } from "./executive-export.service";
import { VerifierCapacityService } from "./verifier-capacity.service";
import { NavigationCountsService } from "./navigation-counts.service";

@Module({
  controllers: [DashboardsController],
  providers: [
    DashboardsService,
    DashboardClientService,
    DashboardExceptionsService,
    ExecutiveAnalyticsService,
    ExecutiveExportService,
    VerifierCapacityService,
    NavigationCountsService,
  ],
})
export class DashboardsModule {}

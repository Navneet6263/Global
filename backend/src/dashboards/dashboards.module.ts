import { Module } from "@nestjs/common";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";
import { DashboardExceptionsService } from "./dashboard-exceptions.service";
import { DashboardClientService } from "./dashboard-client.service";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { ExecutiveExportService } from "./executive-export.service";
import { VerifierCapacityService } from "./verifier-capacity.service";
import { NavigationCountsService } from "./navigation-counts.service";
import { OperationsActionsService } from "./operations-actions.service";
import { OperationsActionsController } from "./operations-actions.controller";

@Module({
  controllers: [DashboardsController, OperationsActionsController],
  providers: [
    DashboardsService,
    DashboardClientService,
    DashboardExceptionsService,
    ExecutiveAnalyticsService,
    ExecutiveExportService,
    VerifierCapacityService,
    NavigationCountsService,
    OperationsActionsService,
  ],
})
export class DashboardsModule {}

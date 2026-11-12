import { TeamMembersController } from "./team-members.controller";
import { TeamMembersService } from "./team-members.service";
import { DataEntryInsightsController } from "./data-entry-insights.controller";
import { DataEntryInsightsService } from "./data-entry-insights.service";
import { DataEntryUnifiedQueueService } from "./data-entry-unified-queue.service";
import { CheckReworkController } from "./check-rework.controller";
import { CheckReworkService } from "./check-rework.service";
import { Module } from "@nestjs/common";
import { ClarificationsModule } from "../clarifications/clarifications.module";
import { ReportsModule } from "../reports/reports.module";
import { CaseWorkflowPolicy } from "../cases/case-workflow.policy";
import { DepartmentsService } from "./departments.service";
import { ClientRmService } from "./client-rm.service";
import { CaseHoldService } from "./case-hold.service";
import { StageAlertService } from "./stage-alert.service";
import { BulkDataEntryService } from "./bulk-data-entry.service";
import { IntakeService } from "./intake.service";
import { RoutingService } from "./routing.service";
import { WorkflowBulkController } from "./workflow-bulk.controller";
import { WorkflowClarificationsController } from "./workflow-clarifications.controller";
import { WorkflowController } from "./workflow.controller";

@Module({
  imports: [ReportsModule, ClarificationsModule],
  controllers: [
    WorkflowController,
    WorkflowBulkController,
    WorkflowClarificationsController,
    CheckReworkController,
    DataEntryInsightsController,
    TeamMembersController,
  ],
  providers: [
    StageAlertService,
    ClientRmService,
    CaseHoldService,
    CaseWorkflowPolicy,
    DepartmentsService,
    IntakeService,
    BulkDataEntryService,
    RoutingService,
    CheckReworkService,
    DataEntryInsightsService,
    DataEntryUnifiedQueueService,
    TeamMembersService,
  ],
})
export class WorkflowModule {}

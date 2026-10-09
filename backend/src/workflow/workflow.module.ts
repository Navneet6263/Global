import { TeamMembersController } from "./team-members.controller";
import { TeamMembersService } from "./team-members.service";
import { DataEntryInsightsController } from "./data-entry-insights.controller";
import { DataEntryInsightsService } from "./data-entry-insights.service";
import { CheckReworkController } from "./check-rework.controller";
import { CheckReworkService } from "./check-rework.service";
import { Module } from "@nestjs/common";
import { ReportsModule } from "../reports/reports.module";
import { CaseWorkflowPolicy } from "../cases/case-workflow.policy";
import { DepartmentsService } from "./departments.service";
import { ClientRmService } from "./client-rm.service";
import { CaseHoldService } from "./case-hold.service";
import { StageAlertService } from "./stage-alert.service";
import { IntakeService } from "./intake.service";
import { RoutingService } from "./routing.service";
import { WorkflowController } from "./workflow.controller";

@Module({
  imports: [ReportsModule],
  controllers: [
    WorkflowController,
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
    RoutingService,
    CheckReworkService,
    DataEntryInsightsService,
    TeamMembersService,
  ],
})
export class WorkflowModule {}

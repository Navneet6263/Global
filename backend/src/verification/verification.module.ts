import { Module } from "@nestjs/common";
import { BulkTaskAssignmentService } from "./bulk-task-assignment.service";
import { TaskAssignmentService } from "./task-assignment.service";
import { TaskCreationService } from "./task-creation.service";
import { TaskQueryService } from "./task-query.service";
import { TaskWorkflowService } from "./task-workflow.service";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { QaReadinessService } from "./qa-readiness.service";
import { TaskContextService } from "./task-context.service";
import { TaskInsightsService } from "./task-insights.service";

@Module({
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskQueryService,
    TaskInsightsService,
    TaskContextService,
    TaskCreationService,
    TaskWorkflowService,
    TaskAssignmentService,
    BulkTaskAssignmentService,
    QaReadinessService,
  ],
  exports: [QaReadinessService],
})
export class VerificationModule {}

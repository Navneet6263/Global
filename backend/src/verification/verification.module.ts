import { Module } from "@nestjs/common";
import { BulkTaskAssignmentService } from "./bulk-task-assignment.service";
import { TaskAssignmentService } from "./task-assignment.service";
import { TaskCreationService } from "./task-creation.service";
import { TaskQueryService } from "./task-query.service";
import { TaskWorkflowService } from "./task-workflow.service";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { QaReadinessService } from "./qa-readiness.service";

@Module({
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskQueryService,
    TaskCreationService,
    TaskWorkflowService,
    TaskAssignmentService,
    BulkTaskAssignmentService,
    QaReadinessService,
  ],
  exports: [QaReadinessService],
})
export class VerificationModule {}

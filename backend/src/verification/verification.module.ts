import { SourceEmailController } from "./source-email.controller";
import { SourceEmailService } from "./source-email.service";
import { SourceEmailFollowUpService } from "./source-email-follow-up.service";
import { Module } from "@nestjs/common";
import { VerifiedDetailsController } from "./verified-details.controller";
import { VerifiedDetailsService } from "./verified-details.service";
import { VerificationMethodsController } from "./verification-methods.controller";
import { VerificationMethodsService } from "./verification-methods.service";
import { SourceOutreachService } from "./source-outreach.service";
import { SourceOutreachController } from "./source-outreach.controller";
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
  controllers: [
    TasksController,
    VerificationMethodsController,
    SourceOutreachController,
    VerifiedDetailsController,
    SourceEmailController,
  ],
  providers: [
    TasksService,
    VerificationMethodsService,
    SourceOutreachService,
    TaskQueryService,
    TaskInsightsService,
    TaskContextService,
    TaskCreationService,
    TaskWorkflowService,
    TaskAssignmentService,
    BulkTaskAssignmentService,
    QaReadinessService,
    VerifiedDetailsService,
    SourceEmailService,
    SourceEmailFollowUpService,
  ],
  exports: [QaReadinessService],
})
export class VerificationModule {}

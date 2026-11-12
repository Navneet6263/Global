import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { VerificationModule } from "../verification/verification.module";
import { ClarificationL1QueueService } from "./clarification-l1-queue.service";
import { ClarificationL2OpsService } from "./clarification-l2-ops.service";
import { ClarificationL2ReentryService } from "./clarification-l2-reentry.service";
import { ClarificationL2SubmissionService } from "./clarification-l2-submission.service";
import { ClarificationTokenService } from "./clarification-token.service";
import { ClarificationsController } from "./clarifications.controller";
import { ClarificationsService } from "./clarifications.service";
import { ClientClarificationResponseService } from "./client-clarification-response.service";
import { InsufficiencyReminderService } from "./insufficiency-reminder.service";

@Module({
  imports: [VerificationModule, DocumentsModule],
  controllers: [ClarificationsController],
  providers: [
    ClarificationsService,
    ClarificationTokenService,
    ClientClarificationResponseService,
    InsufficiencyReminderService,
    ClarificationL1QueueService,
    ClarificationL2SubmissionService,
    ClarificationL2OpsService,
    ClarificationL2ReentryService,
  ],
  exports: [
    ClarificationL1QueueService,
    ClarificationL2SubmissionService,
    ClarificationL2OpsService,
    ClarificationL2ReentryService,
  ],
})
export class ClarificationsModule {}

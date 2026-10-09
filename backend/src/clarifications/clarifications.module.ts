import { Module } from "@nestjs/common";
import { ClarificationsController } from "./clarifications.controller";
import { ClarificationsService } from "./clarifications.service";
import { ClarificationTokenService } from "./clarification-token.service";
import { VerificationModule } from "../verification/verification.module";
import { ClientClarificationResponseService } from "./client-clarification-response.service";
import { InsufficiencyReminderService } from "./insufficiency-reminder.service";

@Module({
  imports: [VerificationModule],
  controllers: [ClarificationsController],
  providers: [
    ClarificationsService,
    ClarificationTokenService,
    ClientClarificationResponseService,
    InsufficiencyReminderService,
  ],
})
export class ClarificationsModule {}

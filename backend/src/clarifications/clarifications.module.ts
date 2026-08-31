import { Module } from "@nestjs/common";
import { ClarificationsController } from "./clarifications.controller";
import { ClarificationsService } from "./clarifications.service";
import { ClarificationTokenService } from "./clarification-token.service";
import { VerificationModule } from "../verification/verification.module";
import { ClientClarificationResponseService } from "./client-clarification-response.service";

@Module({
  imports: [VerificationModule],
  controllers: [ClarificationsController],
  providers: [
    ClarificationsService,
    ClarificationTokenService,
    ClientClarificationResponseService,
  ],
})
export class ClarificationsModule {}

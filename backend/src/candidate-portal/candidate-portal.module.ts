import { Module } from "@nestjs/common";
import { ClarificationsModule } from "../clarifications/clarifications.module";
import { ConsentsModule } from "../consents/consents.module";
import { DocumentsModule } from "../documents/documents.module";
import { SupportModule } from "../support/support.module";
import { CandidatePortalController } from "./candidate-portal.controller";
import { CandidatePortalService } from "./candidate-portal.service";
import { CandidateConsentService } from "./candidate-consent.service";
import { CandidateSupportService } from "./candidate-support.service";

@Module({
  imports: [DocumentsModule, SupportModule, ConsentsModule, ClarificationsModule],
  controllers: [CandidatePortalController],
  providers: [
    CandidatePortalService,
    CandidateSupportService,
    CandidateConsentService,
  ],
})
export class CandidatePortalModule {}

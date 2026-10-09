import { Module } from "@nestjs/common";
import { ClientAgreementFilesService } from "../clients/client-agreement-files.service";
import { ClientCommercialService } from "../clients/client-commercial.service";
import { DocumentsModule } from "../documents/documents.module";
import {
  ClientOnboardingController,
  OpsOnboardingController,
} from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [DocumentsModule],
  controllers: [ClientOnboardingController, OpsOnboardingController],
  providers: [
    OnboardingService,
    ClientAgreementFilesService,
    ClientCommercialService,
  ],
})
export class OnboardingModule {}

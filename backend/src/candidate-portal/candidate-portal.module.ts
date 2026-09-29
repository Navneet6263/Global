import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { SupportModule } from "../support/support.module";
import { CandidatePortalController } from "./candidate-portal.controller";
import { CandidatePortalService } from "./candidate-portal.service";
import { CandidateSupportService } from "./candidate-support.service";

@Module({
  imports: [DocumentsModule, SupportModule],
  controllers: [CandidatePortalController],
  providers: [CandidatePortalService, CandidateSupportService],
})
export class CandidatePortalModule {}

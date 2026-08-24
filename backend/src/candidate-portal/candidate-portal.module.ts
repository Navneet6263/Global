import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { CandidatePortalController } from "./candidate-portal.controller";
import { CandidatePortalService } from "./candidate-portal.service";

@Module({
  imports: [DocumentsModule],
  controllers: [CandidatePortalController],
  providers: [CandidatePortalService],
})
export class CandidatePortalModule {}

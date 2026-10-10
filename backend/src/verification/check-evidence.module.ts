import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { CheckEvidenceController } from "./check-evidence.controller";
import { CheckEvidenceService } from "./check-evidence.service";

/** Proof per check (verifier uploads) for the report annexures. */
@Module({
  imports: [DocumentsModule],
  controllers: [CheckEvidenceController],
  providers: [CheckEvidenceService],
  exports: [CheckEvidenceService],
})
export class CheckEvidenceModule {}

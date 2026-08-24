import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { FieldEvidenceService } from "./field-evidence.service";
import { FieldVisitsController } from "./field-visits.controller";
import { FieldVisitsService } from "./field-visits.service";

@Module({
  imports: [DocumentsModule],
  controllers: [FieldVisitsController],
  providers: [FieldVisitsService, FieldEvidenceService],
})
export class FieldVisitsModule {}

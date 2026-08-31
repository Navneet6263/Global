import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { FieldEvidenceService } from "./field-evidence.service";
import { FieldVisitAssignmentService } from "./field-visit-assignment.service";
import { FieldVisitCheckInService } from "./field-visit-check-in.service";
import { FieldVisitCompletionService } from "./field-visit-completion.service";
import { FieldVisitExceptionService } from "./field-visit-exception.service";
import { FieldVisitQueryService } from "./field-visit-query.service";
import { FieldVisitsController } from "./field-visits.controller";
import { FieldVisitsService } from "./field-visits.service";

@Module({
  imports: [DocumentsModule],
  controllers: [FieldVisitsController],
  providers: [
    FieldVisitsService,
    FieldVisitQueryService,
    FieldVisitAssignmentService,
    FieldVisitCheckInService,
    FieldVisitCompletionService,
    FieldVisitExceptionService,
    FieldEvidenceService,
  ],
})
export class FieldVisitsModule {}

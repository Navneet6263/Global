import { Module } from "@nestjs/common";
import { ConsentsModule } from "../consents/consents.module";
import { CaseWorkflowPolicy } from "./case-workflow.policy";
import { CaseOperationsService } from "./case-operations.service";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";
import { CaseReaderService } from "./case-reader.service";

@Module({
  imports: [ConsentsModule],
  controllers: [CasesController],
  providers: [
    CasesService,
    CaseReaderService,
    CaseWorkflowPolicy,
    CaseOperationsService,
  ],
  exports: [CasesService, CaseReaderService, CaseWorkflowPolicy],
})
export class CasesModule {}

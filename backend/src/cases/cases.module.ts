import { Module } from "@nestjs/common";
import { CaseWorkflowPolicy } from "./case-workflow.policy";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";
import { CaseReaderService } from "./case-reader.service";

@Module({
  controllers: [CasesController],
  providers: [CasesService, CaseReaderService, CaseWorkflowPolicy],
  exports: [CasesService, CaseReaderService, CaseWorkflowPolicy],
})
export class CasesModule {}

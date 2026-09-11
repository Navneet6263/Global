import { Module } from "@nestjs/common";
import { ConsentsModule } from "../consents/consents.module";
import { CaseWorkflowPolicy } from "./case-workflow.policy";
import { CaseOperationsService } from "./case-operations.service";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";
import { CaseReaderService } from "./case-reader.service";
import { CaseActivityController } from "./case-activity.controller";
import { CaseActivityService } from "./case-activity.service";
import { DispatchController } from "./dispatch/dispatch.controller";
import { DispatchPreviewService } from "./dispatch/dispatch-preview.service";
import { DispatchCommitService } from "./dispatch/dispatch-commit.service";

@Module({
  imports: [ConsentsModule],
  controllers: [CasesController, CaseActivityController, DispatchController],
  providers: [
    CasesService,
    CaseReaderService,
    CaseWorkflowPolicy,
    CaseOperationsService,
    CaseActivityService,
    DispatchPreviewService,
    DispatchCommitService,
  ],
  exports: [CasesService, CaseReaderService, CaseWorkflowPolicy],
})
export class CasesModule {}

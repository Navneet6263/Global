import { Module } from "@nestjs/common";
import { CaseActivityService } from "../cases/case-activity.service";
import { SpocCaseDetailService } from "./spoc-case-detail.service";
import { SpocCaseRecordsService } from "./spoc-case-records.service";
import { SpocClientsService } from "./spoc-clients.service";
import { SpocExceptionsService } from "./spoc-exceptions.service";
import { SpocOverviewService } from "./spoc-overview.service";
import { SpocWorkRecordsService } from "./spoc-work-records.service";
import { SpocController } from "./spoc.controller";

@Module({
  controllers: [SpocController],
  providers: [
    CaseActivityService,
    SpocCaseDetailService,
    SpocCaseRecordsService,
    SpocClientsService,
    SpocExceptionsService,
    SpocOverviewService,
    SpocWorkRecordsService,
  ],
})
export class SpocModule {}

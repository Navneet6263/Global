import { ClientReportsController } from "./client-reports.controller";
import { ClientReportsService } from "./client-reports.service";
import { ClientMisScheduleService } from "./client-mis-schedule.service";
import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { ReportPdfService } from "./report-pdf.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportRecoveryService } from "./report-recovery.service";
import { ReportGenerationService } from "./report-generation.service";
import { ManagerReviewService } from "./manager-review.service";
import { CaseReopeningService } from "./case-reopening.service";
import { ReportBillingService } from "./report-billing.service";
import { ReportAccessService } from "./report-access.service";
import { InterimReportService } from "./interim-report.service";
import { ReportPreviewController } from "./report-preview.controller";
import { RmClientMisController } from "./rm-client-mis.controller";
import { ReportRegenerationService } from "./report-regeneration.service";
import { ReportPreviewService } from "./report-preview.service";

@Module({
  imports: [DocumentsModule],
  controllers: [
    ReportsController,
    ClientReportsController,
    ReportPreviewController,
    RmClientMisController,
  ],
  providers: [
    ReportsService,
    ReportPdfService,
    ReportRecoveryService,
    ReportGenerationService,
    ManagerReviewService,
    CaseReopeningService,
    ReportBillingService,
    ReportAccessService,
    InterimReportService,
    ReportPreviewService,
    ReportRegenerationService,
    ClientReportsService,
    ClientMisScheduleService,
  ],
  exports: [ReportsService, ReportRecoveryService, ManagerReviewService],
})
export class ReportsModule {}

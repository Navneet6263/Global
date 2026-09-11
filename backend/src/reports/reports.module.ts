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

@Module({
  imports: [DocumentsModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportPdfService,
    ReportRecoveryService,
    ReportGenerationService,
    ManagerReviewService,
    CaseReopeningService,
    ReportBillingService,
    ReportAccessService,
  ],
  exports: [ReportsService, ReportRecoveryService],
})
export class ReportsModule {}

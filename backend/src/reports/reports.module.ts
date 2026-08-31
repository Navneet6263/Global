import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { ReportPdfService } from "./report-pdf.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportRecoveryService } from "./report-recovery.service";

@Module({
  imports: [DocumentsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportPdfService, ReportRecoveryService],
  exports: [ReportsService, ReportRecoveryService],
})
export class ReportsModule {}

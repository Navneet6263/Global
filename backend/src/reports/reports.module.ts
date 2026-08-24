import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { ReportPdfService } from "./report-pdf.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [DocumentsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportPdfService],
  exports: [ReportsService],
})
export class ReportsModule {}

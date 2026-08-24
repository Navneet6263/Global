import { Module } from "@nestjs/common";
import { FinanceController } from "./finance.controller";
import { InvoicePdfService } from "./invoice-pdf.service";
import { FinanceService } from "./finance.service";

@Module({
  controllers: [FinanceController],
  providers: [FinanceService, InvoicePdfService],
})
export class FinanceModule {}

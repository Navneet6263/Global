import { Module } from "@nestjs/common";
import { FinanceController } from "./finance.controller";
import { FinanceQueryService } from "./finance-query.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { FinanceService } from "./finance.service";
import { InvoiceCancellationService } from "./invoice-cancellation.service";
import { InvoiceCreditService } from "./invoice-credit.service";
import { InvoiceIssueService } from "./invoice-issue.service";
import { InvoicePaymentService } from "./invoice-payment.service";

@Module({
  controllers: [FinanceController],
  providers: [
    FinanceService,
    FinanceQueryService,
    InvoiceIssueService,
    InvoicePaymentService,
    InvoiceCreditService,
    InvoiceCancellationService,
    InvoicePdfService,
  ],
})
export class FinanceModule {}

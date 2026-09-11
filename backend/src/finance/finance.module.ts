import { Module } from "@nestjs/common";
import { FinanceController } from "./finance.controller";
import { FinanceQueryService } from "./finance-query.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { FinanceService } from "./finance.service";
import { InvoiceCancellationService } from "./invoice-cancellation.service";
import { InvoiceCreditService } from "./invoice-credit.service";
import { InvoiceIssueService } from "./invoice-issue.service";
import { InvoicePaymentService } from "./invoice-payment.service";
import { ClientFinanceController } from "./client-finance.controller";
import { ClientFinanceService } from "./client-finance.service";
import { MonthlyStatementController } from "./monthly-statement.controller";
import { MonthlyStatementService } from "./monthly-statement.service";
import { CreditControlController } from "./credit-control.controller";

@Module({
  controllers: [
    FinanceController,
    ClientFinanceController,
    MonthlyStatementController,
    CreditControlController,
  ],
  providers: [
    ClientFinanceService,
    MonthlyStatementService,
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

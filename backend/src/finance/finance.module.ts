import { RmPaymentsController } from "./rm-payments.controller";
import { RmPaymentsService } from "./rm-payments.service";
import { MonthlyBillingService } from "./monthly-billing.service";
import {
  ClientAnnexureController,
  FinanceAnnexureController,
} from "./billing-annexure.controller";
import { BillingAnnexureService } from "./billing-annexure.service";
import { BillingAnnexureAgeingService } from "./billing-annexure-ageing.service";
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
    FinanceAnnexureController,
    ClientAnnexureController,
    RmPaymentsController,
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
    BillingAnnexureService,
    BillingAnnexureAgeingService,
    RmPaymentsService,
    MonthlyBillingService,
  ],
})
export class FinanceModule {}

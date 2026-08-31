import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { CancelInvoiceDto } from "./dto/cancel-invoice.dto";
import type { CreateCreditNoteDto } from "./dto/create-credit-note.dto";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto";
import type { ListInvoicesDto } from "./dto/list-invoices.dto";
import type { RecordPaymentDto } from "./dto/record-payment.dto";
import { FinanceQueryService } from "./finance-query.service";
import { InvoiceCancellationService } from "./invoice-cancellation.service";
import { InvoiceCreditService } from "./invoice-credit.service";
import { InvoiceIssueService } from "./invoice-issue.service";
import { InvoicePaymentService } from "./invoice-payment.service";

@Injectable()
export class FinanceService {
  constructor(
    private readonly queries: FinanceQueryService,
    private readonly issues: InvoiceIssueService,
    private readonly payments: InvoicePaymentService,
    private readonly credits: InvoiceCreditService,
    private readonly cancellations: InvoiceCancellationService,
  ) {}

  overview(actor: Actor) {
    return this.queries.overview(actor);
  }

  list(actor: Actor, query: ListInvoicesDto) {
    return this.queries.list(actor, query);
  }

  exportLedger(actor: Actor, query: ListInvoicesDto) {
    return this.queries.exportLedger(actor, query);
  }

  create(actor: Actor, input: CreateInvoiceDto) {
    return this.issues.create(actor, input);
  }

  downloadInvoice(actor: Actor, publicId: string) {
    return this.issues.download(actor, publicId);
  }

  recordPayment(actor: Actor, publicId: string, input: RecordPaymentDto) {
    return this.payments.record(actor, publicId, input);
  }

  createCreditNote(actor: Actor, publicId: string, input: CreateCreditNoteDto) {
    return this.credits.create(actor, publicId, input);
  }

  cancelInvoice(actor: Actor, publicId: string, input: CancelInvoiceDto) {
    return this.cancellations.cancel(actor, publicId, input);
  }
}

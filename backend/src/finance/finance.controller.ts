import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreateCreditNoteDto } from "./dto/create-credit-note.dto";
import { CancelInvoiceDto } from "./dto/cancel-invoice.dto";
import { ListInvoicesDto } from "./dto/list-invoices.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { FinanceService } from "./finance.service";

@Controller("finance")
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("overview")
  @RequirePermissions(Permission.FinanceRead)
  overview(@CurrentActor() actor: Actor) {
    return this.finance.overview(actor);
  }

  @Get("invoices")
  @RequirePermissions(Permission.FinanceRead)
  list(@CurrentActor() actor: Actor, @Query() query: ListInvoicesDto) {
    return this.finance.list(actor, query);
  }

  @Get("invoices/export")
  @RequirePermissions(Permission.FinanceRead)
  exportLedger(
    @CurrentActor() actor: Actor,
    @Query() query: ListInvoicesDto,
  ): Promise<StreamableFile> {
    return this.finance.exportLedger(actor, query);
  }

  @Get("invoices/:invoiceId/pdf")
  @RequirePermissions(Permission.FinanceRead)
  downloadInvoice(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.finance.downloadInvoice(actor, invoiceId);
  }

  @Post("invoices")
  @RequirePermissions(Permission.FinanceWrite)
  create(@CurrentActor() actor: Actor, @Body() input: CreateInvoiceDto) {
    return this.finance.create(actor, input);
  }

  @Post("invoices/:invoiceId/payments")
  @RequirePermissions(Permission.FinanceWrite)
  recordPayment(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() input: RecordPaymentDto,
  ) {
    return this.finance.recordPayment(actor, invoiceId, input);
  }

  @Post("invoices/:invoiceId/credit-notes")
  @RequirePermissions(Permission.FinanceWrite)
  createCreditNote(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() input: CreateCreditNoteDto,
  ) {
    return this.finance.createCreditNote(actor, invoiceId, input);
  }

  @Patch("invoices/:invoiceId/cancel")
  @RequirePermissions(Permission.FinanceWrite)
  cancelInvoice(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() input: CancelInvoiceDto,
  ) {
    return this.finance.cancelInvoice(actor, invoiceId, input);
  }
}

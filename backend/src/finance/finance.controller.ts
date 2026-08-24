import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
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
}

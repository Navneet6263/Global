import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { RmPaymentsService } from "./rm-payments.service";
import { RecordPaymentDto } from "./dto/record-payment.dto";

export class PaymentReminderDto {
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/** The RM's companies: what is due, and a payment reminder to the company admins. */
@Controller("rm/payments")
@RequireRoles("SPOC_RM", "OPS_MANAGER", "PLATFORM_ADMIN")
export class RmPaymentsController {
  constructor(private readonly payments: RmPaymentsService) {}

  @Get()
  list(@CurrentActor() actor: Actor) {
    return this.payments.list(actor);
  }

  /** Record money received against one of the RM's companies' invoices. */
  @Post("invoices/:invoiceId/payments")
  recordPayment(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() input: RecordPaymentDto,
  ) {
    return this.payments.recordPayment(actor, invoiceId, input);
  }

  @Get("invoices/:invoiceId/pdf")
  invoicePdf(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.payments.invoicePdf(actor, invoiceId);
  }

  @Post(":clientId/remind")
  remind(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: PaymentReminderDto,
  ) {
    return this.payments.remind(actor, clientId, input.note);
  }
}

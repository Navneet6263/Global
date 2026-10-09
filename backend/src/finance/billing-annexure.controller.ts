import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { IsString, Length } from "class-validator";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { BillingAnnexureService } from "./billing-annexure.service";
import { requireClientFinanceScope } from "./client-finance.scope";

export class AnnexureQueryTextDto {
  @IsString() @Length(10, 1000) query!: string;
}

/** Finance: billing annexure and sending it to the company for validation. */
@Controller("finance/invoices/:invoiceId/annexure")
@RequireRoles("PLATFORM_ADMIN", "FINANCE_MANAGER")
export class FinanceAnnexureController {
  constructor(private readonly annexure: BillingAnnexureService) {}

  @Get()
  get(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.annexure.annexure(actor, invoiceId);
  }

  @Get("export")
  export(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.annexure.annexureCsv(actor, invoiceId);
  }

  @Post("send")
  send(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.annexure.send(actor, invoiceId);
  }
}

/** Company Admin: see the annexure, validate the bill or raise a query. */
@Controller("client-finance/invoices/:invoiceId/annexure")
@RequireRoles("CLIENT_ADMIN")
export class ClientAnnexureController {
  constructor(private readonly annexure: BillingAnnexureService) {}

  @Get()
  get(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    requireClientFinanceScope(actor);
    return this.annexure.annexure(actor, invoiceId);
  }

  @Get("export")
  export(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    requireClientFinanceScope(actor);
    return this.annexure.annexureCsv(actor, invoiceId);
  }

  @Post("validate")
  validate(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    requireClientFinanceScope(actor);
    return this.annexure.validate(actor, invoiceId);
  }

  @Post("query")
  query(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() input: AnnexureQueryTextDto,
  ) {
    requireClientFinanceScope(actor);
    return this.annexure.query(actor, invoiceId, input.query);
  }
}

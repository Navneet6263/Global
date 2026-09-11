import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { ListInvoicesDto } from "./dto/list-invoices.dto";
import { ClientFinanceService } from "./client-finance.service";
import { requireClientFinanceScope } from "./client-finance.scope";

@Controller("client-finance")
@RequireRoles("CLIENT_ADMIN")
export class ClientFinanceController {
  constructor(private readonly finance: ClientFinanceService) {}

  @Get("overview")
  overview(@CurrentActor() actor: Actor) {
    requireClientFinanceScope(actor);
    return this.finance.overview(actor);
  }

  @Get("invoices")
  list(@CurrentActor() actor: Actor, @Query() query: ListInvoicesDto) {
    requireClientFinanceScope(actor);
    return this.finance.list(actor, query);
  }

  @Get("invoices/:invoiceId/pdf")
  download(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    requireClientFinanceScope(actor);
    return this.finance.download(actor, invoiceId);
  }
}

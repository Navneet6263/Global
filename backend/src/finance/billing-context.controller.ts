import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { BillingContextService } from "./billing-context.service";

/** What Finance sees beside the invoice form once a company is chosen. */
@Controller("finance/clients")
@RequireRoles("PLATFORM_ADMIN", "FINANCE_MANAGER")
export class BillingContextController {
  constructor(private readonly context: BillingContextService) {}

  @Get(":clientId/billing-context")
  @RequirePermissions(Permission.FinanceRead)
  get(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
  ) {
    return this.context.forClient(actor, clientId);
  }
}

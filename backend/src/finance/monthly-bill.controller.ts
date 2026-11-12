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
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import {
  IssueMonthlyBillDto,
  MonthlyBillPeriodDto,
} from "./dto/monthly-bill.dto";
import { MonthlyBillService } from "./monthly-bill.service";

/** Finance: prepare the month's bills, follow their validation, issue tax invoices. */
@Controller("finance/monthly-bills")
@RequireRoles("PLATFORM_ADMIN", "FINANCE_MANAGER")
export class MonthlyBillController {
  constructor(private readonly bills: MonthlyBillService) {}

  @Get()
  @RequirePermissions(Permission.FinanceRead)
  list(@CurrentActor() actor: Actor, @Query() query: MonthlyBillPeriodDto) {
    return this.bills.list(actor, query.period);
  }

  @Post("prepare")
  @RequirePermissions(Permission.FinanceWrite)
  prepare(@CurrentActor() actor: Actor, @Body() input: MonthlyBillPeriodDto) {
    return this.bills.prepare(actor.tenantId, actor.userId, input.period);
  }

  @Post(":invoiceId/issue")
  @RequirePermissions(Permission.FinanceWrite)
  issue(
    @CurrentActor() actor: Actor,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() input: IssueMonthlyBillDto,
  ) {
    return this.bills.issue(actor, invoiceId, input);
  }
}

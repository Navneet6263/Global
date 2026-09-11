import { Controller, Get, Query } from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { MonthlyStatementDto } from "./dto/monthly-statement.dto";
import { MonthlyStatementService } from "./monthly-statement.service";

@Controller()
export class MonthlyStatementController {
  constructor(private readonly statements: MonthlyStatementService) {}

  @Get("client-finance/statement")
  @RequireRoles("CLIENT_ADMIN")
  @RequirePermissions(Permission.CaseRead)
  client(@CurrentActor() actor: Actor, @Query() query: MonthlyStatementDto) {
    return this.statements.download(actor, query, true);
  }

  @Get("finance/client-statement")
  @RequireRoles("PLATFORM_ADMIN", "FINANCE_MANAGER")
  @RequirePermissions(Permission.FinanceRead)
  finance(@CurrentActor() actor: Actor, @Query() query: MonthlyStatementDto) {
    return this.statements.download(actor, query, false);
  }
}

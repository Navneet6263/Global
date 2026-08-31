import { Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentActor,
  Public,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { ReportsService } from "./reports.service";
import { ReportRecoveryService } from "./report-recovery.service";

@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly recovery: ReportRecoveryService,
  ) {}

  @Get("cases/:caseId/reports")
  @RequirePermissions(Permission.ReportRead)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "CLIENT_ADMIN", "QA_REVIEWER")
  list(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.reports.listForCase(actor, caseId);
  }

  @Post("cases/:caseId/reports/generate")
  @RequirePermissions(Permission.ReportGenerate)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "QA_REVIEWER")
  generate(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.reports.generate(actor, caseId);
  }

  @Post("cases/:caseId/reports/:reportId/retry")
  @RequirePermissions(Permission.ReportGenerate)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "QA_REVIEWER")
  retry(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("reportId", ParseUUIDPipe) reportId: string,
  ) {
    return this.recovery.retry(actor, caseId, reportId);
  }

  @Get("reports/:reportId/content")
  @RequirePermissions(Permission.ReportRead)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "CLIENT_ADMIN", "QA_REVIEWER")
  download(
    @CurrentActor() actor: Actor,
    @Param("reportId", ParseUUIDPipe) reportId: string,
  ) {
    return this.reports.download(actor, reportId);
  }

  @Get("public/reports/verify/:authenticityCode")
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  verify(@Param("authenticityCode") authenticityCode: string) {
    return this.reports.verify(authenticityCode.trim().toUpperCase());
  }
}

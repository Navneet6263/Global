import { Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentActor,
  Public,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { ReportsService } from "./reports.service";

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("cases/:caseId/reports")
  @RequirePermissions(Permission.ReportRead)
  list(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.reports.listForCase(actor, caseId);
  }

  @Post("cases/:caseId/reports/generate")
  @RequirePermissions(Permission.ReportGenerate)
  generate(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.reports.generate(actor, caseId);
  }

  @Get("reports/:reportId/content")
  @RequirePermissions(Permission.ReportRead)
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

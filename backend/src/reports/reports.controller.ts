import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentActor,
  Public,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { PageQueryDto } from "../common/dto/page-query.dto";
import { ReportsService } from "./reports.service";
import { ReportRecoveryService } from "./report-recovery.service";
import { ManagerReviewService } from "./manager-review.service";
import { CaseReopeningService } from "./case-reopening.service";
import { ManagerReviewDto, ReopenCaseDto } from "./dto/manager-review.dto";
import { ReportBillingService } from "./report-billing.service";
import { ReportAccessService } from "./report-access.service";

@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly recovery: ReportRecoveryService,
    private readonly manager: ManagerReviewService,
    private readonly reopening: CaseReopeningService,
    private readonly billing: ReportBillingService,
    private readonly access: ReportAccessService,
  ) {}

  @Get("reports/:reportId/preview")
  @RequirePermissions(Permission.ReportRead)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  preview(
    @CurrentActor() actor: Actor,
    @Param("reportId", ParseUUIDPipe) reportId: string,
  ) {
    return this.access.preview(actor, reportId);
  }

  @Post("reports/:reportId/download-access")
  @RequirePermissions(Permission.ReportGenerate)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  renewAccess(
    @CurrentActor() actor: Actor,
    @Param("reportId", ParseUUIDPipe) reportId: string,
  ) {
    return this.access.renew(actor, reportId);
  }

  @Get("finance/billing-ready")
  @RequirePermissions(Permission.FinanceRead)
  @RequireRoles("PLATFORM_ADMIN", "FINANCE_MANAGER")
  billingReady(@CurrentActor() actor: Actor, @Query() query: PageQueryDto) {
    return this.billing.ready(actor, query);
  }

  @Get("cases/:caseId/approval")
  @RequirePermissions(Permission.CaseRead)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  approval(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.manager.overview(actor, caseId);
  }

  @Post("cases/:caseId/manager-review")
  @RequirePermissions(Permission.CaseTransition)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  managerReview(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: ManagerReviewDto,
  ) {
    return this.manager.decide(actor, caseId, input);
  }

  @Post("cases/:caseId/reopen")
  @RequirePermissions(Permission.CaseTransition)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  reopen(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: ReopenCaseDto,
  ) {
    return this.reopening.reopen(actor, caseId, input);
  }

  @Post("cases/:caseId/reports/:reportId/release")
  @RequirePermissions(Permission.ReportGenerate)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  release(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("reportId", ParseUUIDPipe) reportId: string,
  ) {
    return this.reports.release(actor, caseId, reportId);
  }

  @Get("reports")
  @RequirePermissions(Permission.ReportRead)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "CLIENT_ADMIN", "QA_REVIEWER")
  published(@CurrentActor() actor: Actor, @Query() query: PageQueryDto) {
    return this.reports.listPublished(actor, query);
  }

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
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  generate(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.reports.generate(actor, caseId);
  }

  @Post("cases/:caseId/reports/:reportId/retry")
  @RequirePermissions(Permission.ReportGenerate)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
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

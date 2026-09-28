import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { SPOC_ROLES } from "../common/auth/roles";
import { SpocExceptionQueryDto } from "./dto/spoc-exception.dto";
import {
  SpocActivityQueryDto,
  SpocCaseQueryDto,
  SpocClientQueryDto,
  SpocInvoiceQueryDto,
  SpocOpportunityQueryDto,
  SpocOverviewQueryDto,
  SpocQaQueryDto,
  SpocTaskQueryDto,
  SpocVisitQueryDto,
} from "./dto/spoc-query.dto";
import { SpocCaseDetailService } from "./spoc-case-detail.service";
import { SpocCaseRecordsService } from "./spoc-case-records.service";
import { SpocClientsService } from "./spoc-clients.service";
import { SpocExceptionsService } from "./spoc-exceptions.service";
import { SpocOverviewService } from "./spoc-overview.service";
import { SpocWorkRecordsService } from "./spoc-work-records.service";
import { enforceSpocClient } from "./spoc-scope";

/**
 * SPOC-RM central monitor. Read-only by design: GET handlers only, and the
 * SPOC_RM role holds no write permission anywhere in the application.
 */
@Controller("spoc")
@RequireRoles(...SPOC_ROLES)
@RequirePermissions(Permission.DashboardRead)
export class SpocController {
  constructor(
    private readonly overviewService: SpocOverviewService,
    private readonly exceptionsService: SpocExceptionsService,
    private readonly clientsService: SpocClientsService,
    private readonly caseRecords: SpocCaseRecordsService,
    private readonly workRecords: SpocWorkRecordsService,
    private readonly caseDetail: SpocCaseDetailService,
  ) {}

  @Get("overview")
  overview(@CurrentActor() actor: Actor, @Query() query: SpocOverviewQueryDto) {
    return this.overviewService.overview(
      actor,
      enforceSpocClient(actor, query),
    );
  }

  @Get("filters")
  filters(@CurrentActor() actor: Actor) {
    return this.overviewService.filters(actor);
  }

  @Get("exceptions")
  exceptions(
    @CurrentActor() actor: Actor,
    @Query() query: SpocExceptionQueryDto,
  ) {
    return this.exceptionsService.list(actor, enforceSpocClient(actor, query));
  }

  @Get("clients")
  clients(@CurrentActor() actor: Actor, @Query() query: SpocClientQueryDto) {
    return this.clientsService.list(actor, enforceSpocClient(actor, query));
  }

  @Get("cases")
  cases(@CurrentActor() actor: Actor, @Query() query: SpocCaseQueryDto) {
    return this.caseRecords.cases(actor, enforceSpocClient(actor, query));
  }

  @Get("cases/:caseId")
  caseById(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.caseDetail.detail(actor, caseId);
  }

  @Get("cases/:caseId/activity")
  caseActivity(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Query() query: SpocActivityQueryDto,
  ) {
    return this.caseDetail.activityFor(actor, caseId, query);
  }

  @Get("qa")
  qa(@CurrentActor() actor: Actor, @Query() query: SpocQaQueryDto) {
    return this.caseRecords.qa(actor, enforceSpocClient(actor, query));
  }

  @Get("tasks")
  tasks(@CurrentActor() actor: Actor, @Query() query: SpocTaskQueryDto) {
    return this.workRecords.tasks(actor, enforceSpocClient(actor, query));
  }

  @Get("field-visits")
  fieldVisits(@CurrentActor() actor: Actor, @Query() query: SpocVisitQueryDto) {
    return this.workRecords.visits(actor, enforceSpocClient(actor, query));
  }

  @Get("opportunities")
  opportunities(
    @CurrentActor() actor: Actor,
    @Query() query: SpocOpportunityQueryDto,
  ) {
    return this.workRecords.opportunities(
      actor,
      enforceSpocClient(actor, query),
    );
  }

  @Get("invoices")
  invoices(@CurrentActor() actor: Actor, @Query() query: SpocInvoiceQueryDto) {
    return this.workRecords.invoices(actor, enforceSpocClient(actor, query));
  }
}

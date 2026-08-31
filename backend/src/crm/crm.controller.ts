import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CrmService } from "./crm.service";
import { CrmFollowUpService } from "./crm-follow-up.service";
import { CrmHandoffService } from "./crm-handoff.service";
import { CompleteFollowUpDto } from "./dto/complete-follow-up.dto";
import { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import { ListOpportunitiesDto } from "./dto/list-opportunities.dto";
import { ListSalesActivitiesDto } from "./dto/list-sales-activities.dto";
import { UpdateOpportunityDto } from "./dto/update-opportunity.dto";
import { CreateSalesActivityDto } from "./dto/create-sales-activity.dto";
import { PrepareOnboardingDto } from "./dto/prepare-onboarding.dto";
import { UpdateCrmSettingsDto } from "./dto/update-crm-settings.dto";
import { CrmSettingsService } from "./crm-settings.service";

@Controller("crm")
@RequireRoles("PLATFORM_ADMIN", "SALES_MANAGER")
export class CrmController {
  constructor(
    private readonly crm: CrmService,
    private readonly followUps: CrmFollowUpService,
    private readonly handoffs: CrmHandoffService,
    private readonly settings: CrmSettingsService,
  ) {}

  @Get("overview")
  @RequirePermissions(Permission.CrmRead)
  overview(@CurrentActor() actor: Actor) {
    return this.crm.overview(actor);
  }

  @Get("opportunities")
  @RequirePermissions(Permission.CrmRead)
  list(@CurrentActor() actor: Actor, @Query() query: ListOpportunitiesDto) {
    return this.crm.list(actor, query);
  }

  @Get("owners")
  @RequirePermissions(Permission.CrmRead)
  owners(@CurrentActor() actor: Actor) {
    return this.crm.owners(actor);
  }

  @Get("settings")
  @RequirePermissions(Permission.CrmRead)
  settingsDetail(@CurrentActor() actor: Actor) {
    return this.settings.get(actor);
  }

  @Put("settings")
  @RequireRoles("SALES_MANAGER")
  @RequirePermissions(Permission.CrmWrite)
  updateSettings(
    @CurrentActor() actor: Actor,
    @Body() input: UpdateCrmSettingsDto,
  ) {
    return this.settings.update(actor, input);
  }

  @Get("activities")
  @RequirePermissions(Permission.CrmRead)
  activities(
    @CurrentActor() actor: Actor,
    @Query() query: ListSalesActivitiesDto,
  ) {
    return this.crm.listActivities(actor, query);
  }

  @Get("opportunities/:opportunityId")
  @RequirePermissions(Permission.CrmRead)
  detail(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) opportunityId: string,
  ) {
    return this.crm.detail(actor, opportunityId);
  }

  @Post("opportunities")
  @RequirePermissions(Permission.CrmWrite)
  create(@CurrentActor() actor: Actor, @Body() input: CreateOpportunityDto) {
    return this.crm.create(actor, input);
  }

  @Patch("opportunities/:opportunityId")
  @RequirePermissions(Permission.CrmWrite)
  update(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) opportunityId: string,
    @Body() input: UpdateOpportunityDto,
  ) {
    return this.crm.update(actor, opportunityId, input);
  }

  @Post("opportunities/:opportunityId/activities")
  @RequirePermissions(Permission.CrmWrite)
  addActivity(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) opportunityId: string,
    @Body() input: CreateSalesActivityDto,
  ) {
    return this.crm.addActivity(actor, opportunityId, input);
  }

  @Post("opportunities/:opportunityId/follow-up/complete")
  @RequirePermissions(Permission.CrmWrite)
  completeFollowUp(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) opportunityId: string,
    @Body() input: CompleteFollowUpDto,
  ) {
    return this.followUps.complete(actor, opportunityId, input);
  }

  @Post("opportunities/:opportunityId/onboarding-handoff")
  @RequirePermissions(Permission.CrmWrite)
  prepareOnboarding(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) opportunityId: string,
    @Body() input: PrepareOnboardingDto,
  ) {
    return this.handoffs.prepare(actor, opportunityId, input);
  }
}

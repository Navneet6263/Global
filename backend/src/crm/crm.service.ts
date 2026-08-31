import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { CrmActivityService } from "./crm-activity.service";
import { CrmOpportunityService } from "./crm-opportunity.service";
import { CrmOverviewService } from "./crm-overview.service";
import { CrmQueryService } from "./crm-query.service";
import type { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import type { CreateSalesActivityDto } from "./dto/create-sales-activity.dto";
import type { ListOpportunitiesDto } from "./dto/list-opportunities.dto";
import type { ListSalesActivitiesDto } from "./dto/list-sales-activities.dto";
import type { UpdateOpportunityDto } from "./dto/update-opportunity.dto";

@Injectable()
export class CrmService {
  constructor(
    private readonly queries: CrmQueryService,
    private readonly overviews: CrmOverviewService,
    private readonly opportunities: CrmOpportunityService,
    private readonly activities: CrmActivityService,
  ) {}

  overview(actor: Actor) {
    return this.overviews.get(actor);
  }

  list(actor: Actor, query: ListOpportunitiesDto) {
    return this.queries.list(actor, query);
  }

  owners(actor: Actor) {
    return this.queries.owners(actor);
  }

  detail(actor: Actor, publicId: string) {
    return this.queries.detail(actor, publicId);
  }

  create(actor: Actor, input: CreateOpportunityDto) {
    return this.opportunities.create(actor, input);
  }

  update(actor: Actor, publicId: string, input: UpdateOpportunityDto) {
    return this.opportunities.update(actor, publicId, input);
  }

  addActivity(actor: Actor, publicId: string, input: CreateSalesActivityDto) {
    return this.activities.add(actor, publicId, input);
  }

  listActivities(actor: Actor, query: ListSalesActivitiesDto) {
    return this.activities.list(actor, query);
  }
}

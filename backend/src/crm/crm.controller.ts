import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CrmService } from "./crm.service";
import { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import { ListOpportunitiesDto } from "./dto/list-opportunities.dto";
import { UpdateOpportunityDto } from "./dto/update-opportunity.dto";

@Controller("crm")
export class CrmController {
  constructor(private readonly crm: CrmService) {}

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
}

import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CrmProposalService } from "./crm-proposal.service";
import { CreateProposalDto, ProposalDecisionDto } from "./dto/crm-proposal.dto";
import { proposalPdf } from "./crm-proposal-pdf";

@Controller("crm/opportunities/:opportunityId/proposals")
@RequireRoles("PLATFORM_ADMIN", "SALES_MANAGER")
export class CrmProposalController {
  constructor(private readonly service: CrmProposalService) {}
  @Get()
  @RequirePermissions(Permission.CrmRead)
  list(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) id: string,
  ) {
    return this.service.list(actor, id);
  }
  @Post()
  @RequirePermissions(Permission.CrmWrite)
  create(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) id: string,
    @Body() input: CreateProposalDto,
  ) {
    return this.service.create(actor, id, input);
  }
  @Patch(":proposalId")
  @RequirePermissions(Permission.CrmWrite)
  decide(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) id: string,
    @Param("proposalId", ParseUUIDPipe) proposalId: string,
    @Body() input: ProposalDecisionDto,
  ) {
    return this.service.decide(actor, id, proposalId, input);
  }
  @Get(":proposalId/pdf")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permission.CrmRead)
  async pdf(
    @CurrentActor() actor: Actor,
    @Param("opportunityId", ParseUUIDPipe) id: string,
    @Param("proposalId", ParseUUIDPipe) proposalId: string,
  ) {
    const row = await this.service.forDownload(actor, id, proposalId);
    return new StreamableFile(await proposalPdf(row), {
      type: "application/pdf",
      disposition: `attachment; filename="proposal-r${row.revision}.pdf"`,
    });
  }
}

import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmActivityService } from "./crm-activity.service";
import { CrmFollowUpService } from "./crm-follow-up.service";
import { CrmHandoffService } from "./crm-handoff.service";
import { CrmOpportunityService } from "./crm-opportunity.service";
import { CrmOverviewService } from "./crm-overview.service";
import { CrmQueryService } from "./crm-query.service";
import { CrmService } from "./crm.service";
import { CrmSettingsService } from "./crm-settings.service";
import { CrmSequenceController } from "./crm-sequence.controller";
import { CrmProposalController } from "./crm-proposal.controller";
import { CrmProposalService } from "./crm-proposal.service";
import { CrmAutoAssignmentController } from "./crm-auto-assignment.controller";

@Module({
  controllers: [CrmController, CrmSequenceController, CrmProposalController, CrmAutoAssignmentController],
  providers: [
    CrmService,
    CrmQueryService,
    CrmOpportunityService,
    CrmOverviewService,
    CrmActivityService,
    CrmFollowUpService,
    CrmHandoffService,
    CrmSettingsService,
    CrmProposalService,
  ],
})
export class CrmModule {}

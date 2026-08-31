import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { QaDecisionDto } from "./dto/qa-decision.dto";
import { QaQueryDto } from "./dto/qa-query.dto";
import { ClaimQaCaseDto } from "./dto/claim-qa-case.dto";
import { QaService } from "./qa.service";

@Controller("qa")
@RequirePermissions(Permission.QaReview)
@RequireRoles("QA_REVIEWER")
export class QaController {
  constructor(private readonly qa: QaService) {}

  @Get("queue")
  @RequireRoles("PLATFORM_ADMIN", "QA_REVIEWER")
  queue(@CurrentActor() actor: Actor, @Query() query: QaQueryDto) {
    return this.qa.queue(actor, query);
  }

  @Post("cases/:caseId/claim")
  @RequireRoles("QA_REVIEWER")
  claim(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: ClaimQaCaseDto,
  ) {
    return this.qa.claim(actor, caseId, input.caseVersion);
  }

  @Post("cases/:caseId/decision")
  @RequireRoles("QA_REVIEWER")
  decide(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: QaDecisionDto,
  ) {
    return this.qa.decide(actor, caseId, input);
  }
}

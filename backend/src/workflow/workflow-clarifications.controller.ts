import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import { Permission } from "../common/auth/permissions";
import { ClarificationL2ReentryService } from "../clarifications/clarification-l2-reentry.service";
import {
  CompleteL2ReentryDto,
  ReentryQueueQueryDto,
  RejectL2DocumentDto,
} from "../clarifications/dto/l2-clarification.dto";

@Controller("workflow/clarifications")
export class WorkflowClarificationsController {
  constructor(private readonly reentry: ClarificationL2ReentryService) {}

  @Get("reentry")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "DATA_ENTRY")
  @RequirePermissions(Permission.ClarificationRead)
  queue(@CurrentActor() actor: Actor, @Query() query: ReentryQueueQueryDto) {
    return this.reentry.queue(actor, query);
  }

  @Get(":clarificationId")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "DATA_ENTRY")
  @RequirePermissions(Permission.ClarificationRead)
  detail(
    @CurrentActor() actor: Actor,
    @Param("clarificationId", ParseUUIDPipe) clarificationId: string,
  ) {
    return this.reentry.detail(actor, clarificationId);
  }

  @Post(":clarificationId/reject-document")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "DATA_ENTRY")
  @RequirePermissions(Permission.ClarificationWrite)
  rejectDocument(
    @CurrentActor() actor: Actor,
    @Param("clarificationId", ParseUUIDPipe) clarificationId: string,
    @Body() input: RejectL2DocumentDto,
  ) {
    return this.reentry.rejectDocument(actor, clarificationId, input);
  }

  @Post(":clarificationId/complete-reentry")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "DATA_ENTRY")
  @RequirePermissions(Permission.ClarificationWrite)
  completeReentry(
    @CurrentActor() actor: Actor,
    @Param("clarificationId", ParseUUIDPipe) clarificationId: string,
    @Body() input: CompleteL2ReentryDto,
  ) {
    return this.reentry.completeReentry(actor, clarificationId, input);
  }
}

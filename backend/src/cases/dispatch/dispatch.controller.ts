import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../../common/auth/auth.decorators";
import type { Actor } from "../../common/auth/actor";
import { Permission } from "../../common/auth/permissions";
import { DispatchPreviewService } from "./dispatch-preview.service";
import { DispatchCommitService } from "./dispatch-commit.service";
import { DispatchCommitDto, DispatchPreviewDto } from "./dispatch.dto";

@Controller("cases/dispatch")
@RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
@RequirePermissions(
  Permission.CaseRead,
  Permission.CaseTransition,
  Permission.TaskWrite,
)
export class DispatchController {
  constructor(
    private readonly previewService: DispatchPreviewService,
    private readonly commitService: DispatchCommitService,
  ) {}

  @Get("preview")
  @Header("Cache-Control", "no-store")
  preview(@CurrentActor() actor: Actor, @Query() query: DispatchPreviewDto) {
    return this.previewService.preview(actor, query.caseIds);
  }

  @Post(":caseId/commit")
  commit(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: DispatchCommitDto,
  ) {
    return this.commitService.commit(actor, caseId, input);
  }
}

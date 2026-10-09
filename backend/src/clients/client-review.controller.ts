import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { IsInt, IsString, Length, Min } from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { ClientReviewService } from "./client-review.service";

export class ClientReviewDecisionDto {
  @IsInt()
  @Min(1)
  version!: number;
}

export class ClientReviewReturnDto extends ClientReviewDecisionDto {
  @IsString()
  @Length(10, 500)
  reason!: string;
}

/** Route A: the company admin reviews its candidates' submissions first. */
@Controller("client-review")
@RequireRoles("CLIENT_ADMIN")
@RequirePermissions(Permission.CaseRead)
export class ClientReviewController {
  constructor(private readonly review: ClientReviewService) {}

  @Get()
  list(@CurrentActor() actor: Actor) {
    return this.review.list(actor);
  }

  @Post(":caseId/approve")
  approve(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: ClientReviewDecisionDto,
  ) {
    return this.review.approve(actor, caseId, input.version);
  }

  @Post(":caseId/return")
  returnToCandidate(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: ClientReviewReturnDto,
  ) {
    return this.review.returnToCandidate(
      actor,
      caseId,
      input.version,
      input.reason,
    );
  }
}

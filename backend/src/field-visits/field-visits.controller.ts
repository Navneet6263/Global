import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  StreamableFile,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyRequest } from "fastify";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { withUploadedBinary } from "../common/http/upload-capacity";
import { CompleteFieldVisitDto } from "./dto/complete-field-visit.dto";
import { CheckInFieldVisitDto } from "./dto/check-in-field-visit.dto";
import { CreateFieldVisitDto } from "./dto/create-field-visit.dto";
import { ReviewFieldExceptionDto } from "./dto/review-field-exception.dto";
import { FieldEvidenceService } from "./field-evidence.service";
import { FieldVisitsService } from "./field-visits.service";

@Controller()
export class FieldVisitsController {
  constructor(
    private readonly visits: FieldVisitsService,
    private readonly evidence: FieldEvidenceService,
    private readonly config: ConfigService,
  ) {}

  @Get("field-visits/mine")
  @RequireRoles("FIELD_EXECUTIVE")
  @RequirePermissions(Permission.FieldVisitRead)
  mine(@CurrentActor() actor: Actor) {
    return this.visits.mine(actor);
  }

  @Get("field-evidence/:evidenceId/content")
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "QA_REVIEWER",
    "FIELD_EXECUTIVE",
  )
  @RequirePermissions(Permission.FieldEvidenceRead)
  async downloadEvidence(
    @CurrentActor() actor: Actor,
    @Param("evidenceId", ParseUUIDPipe) evidenceId: string,
  ): Promise<StreamableFile> {
    return this.evidence.download(actor, evidenceId);
  }

  @Post("cases/:caseId/field-visits")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  @RequirePermissions(Permission.FieldVisitWrite)
  create(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: CreateFieldVisitDto,
  ) {
    return this.visits.create(actor, caseId, input);
  }

  @Post("field-visits/:visitId/evidence")
  @RequireRoles("FIELD_EXECUTIVE")
  @RequirePermissions(Permission.FieldVisitWrite)
  async addEvidence(
    @CurrentActor() actor: Actor,
    @Param("visitId", ParseUUIDPipe) visitId: string,
    @Headers("x-captured-at") capturedAt: string | undefined,
    @Headers("x-evidence-id") evidenceId: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `${actor.tenantPublicId}:${actor.userPublicId}`,
      (file) => this.evidence.add(actor, visitId, file, capturedAt, evidenceId),
    );
  }

  @Post("field-visits/:visitId/check-in")
  @RequireRoles("FIELD_EXECUTIVE")
  @RequirePermissions(Permission.FieldVisitWrite)
  checkIn(
    @CurrentActor() actor: Actor,
    @Param("visitId", ParseUUIDPipe) visitId: string,
    @Body() input: CheckInFieldVisitDto,
  ) {
    return this.visits.checkIn(actor, visitId, input);
  }

  @Patch("field-visits/:visitId/complete")
  @RequireRoles("FIELD_EXECUTIVE")
  @RequirePermissions(Permission.FieldVisitWrite)
  complete(
    @CurrentActor() actor: Actor,
    @Param("visitId", ParseUUIDPipe) visitId: string,
    @Body() input: CompleteFieldVisitDto,
  ) {
    return this.visits.complete(actor, visitId, input);
  }

  @Patch("field-visits/:visitId/exception")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  @RequirePermissions(Permission.FieldVisitWrite)
  reviewException(
    @CurrentActor() actor: Actor,
    @Param("visitId", ParseUUIDPipe) visitId: string,
    @Body() input: ReviewFieldExceptionDto,
  ) {
    return this.visits.reviewException(actor, visitId, input);
  }
}

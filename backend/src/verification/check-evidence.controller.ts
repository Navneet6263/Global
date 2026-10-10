import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { IsOptional, IsString, MaxLength } from "class-validator";
import type { FastifyRequest } from "fastify";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { withUploadedBinary } from "../common/http/upload-capacity";
import { CheckEvidenceService } from "./check-evidence.service";

export class EvidenceCaptionDto {
  @IsOptional() @IsString() @MaxLength(300) caption?: string;
}

/** Proof attached to a check for its report annexure. */
@Controller("checks/:checkId/evidence")
@RequireRoles(
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "VERIFIER",
  "QA_REVIEWER",
  "SPOC_RM",
)
export class CheckEvidenceController {
  constructor(
    private readonly evidence: CheckEvidenceService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
  ) {
    return this.evidence.list(actor, checkId);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  upload(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Query() query: EvidenceCaptionDto,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `check-evidence:${actor.userPublicId}`,
      (file) => this.evidence.upload(actor, checkId, file, query.caption),
    );
  }

  @Patch(":fileId")
  caption(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
    @Body() input: EvidenceCaptionDto,
  ) {
    return this.evidence.setCaption(
      actor,
      checkId,
      fileId,
      input.caption ?? "",
    );
  }

  @Delete(":fileId")
  remove(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return this.evidence.remove(actor, checkId, fileId);
  }

  @Get(":fileId")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  file(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return this.evidence.file(actor, checkId, fileId);
  }
}

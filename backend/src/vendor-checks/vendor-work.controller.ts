import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import type { FastifyRequest } from "fastify";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { withUploadedBinary } from "../common/http/upload-capacity";
import { VendorBoardQueryDto } from "./vendor-checks.controller";
import { VendorWorkService } from "./vendor-work.service";

export class VendorVersionDto {
  @IsInt() @Min(1) version!: number;
}

export class VendorDeclineDto extends VendorVersionDto {
  @IsString() @MaxLength(1000) reason!: string;
}

export class VendorDraftDto extends VendorVersionDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsObject({ each: true })
  entries!: Array<Record<string, unknown>>;
  @IsOptional() @IsString() @MaxLength(24) result?: string;
  @IsOptional() @IsString() @MaxLength(2000) remarks?: string;
}

export class VendorDelegateDto extends VendorVersionDto {
  @ValidateIf((_, value) => value !== null) @IsUUID() userId!: string | null;
}

/** Vendor workspace: the checks assigned to this vendor login. */
@Controller("vendor/checks")
@RequireRoles("VENDOR")
@RequirePermissions(Permission.VendorReview)
export class VendorWorkController {
  constructor(
    private readonly work: VendorWorkService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: VendorBoardQueryDto) {
    return this.work.list(actor, query);
  }

  @Get("export")
  export(@CurrentActor() actor: Actor, @Query() query: VendorBoardQueryDto) {
    return this.work.export(actor, query);
  }

  @Get(":jobId")
  detail(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
  ) {
    return this.work.detail(actor, jobId);
  }

  @Post(":jobId/accept")
  accept(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() input: VendorVersionDto,
  ) {
    return this.work.accept(actor, jobId, input.version);
  }

  @Post(":jobId/decline")
  decline(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() input: VendorDeclineDto,
  ) {
    return this.work.decline(actor, jobId, input.version, input.reason);
  }

  @Put(":jobId/draft")
  draft(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() input: VendorDraftDto,
  ) {
    return this.work.saveDraft(actor, jobId, input);
  }

  @Post(":jobId/submit")
  submit(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() input: VendorVersionDto,
  ) {
    return this.work.submit(actor, jobId, input.version);
  }

  @Post(":jobId/delegate")
  delegate(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() input: VendorDelegateDto,
  ) {
    return this.work.delegate(actor, jobId, input);
  }

  @Post(":jobId/evidence")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  upload(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `vendor-check:${actor.userPublicId}`,
      (file) => this.work.uploadEvidence(actor, jobId, file),
    );
  }

  @Delete(":jobId/evidence/:fileId")
  removeEvidence(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return this.work.removeEvidence(actor, jobId, fileId);
  }

  @Get(":jobId/evidence/:fileId")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  evidenceFile(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return this.work.evidenceFile(actor, jobId, fileId);
  }

  @Get(":jobId/documents/:documentId")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  document(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ) {
    return this.work.document(actor, jobId, documentId);
  }
}

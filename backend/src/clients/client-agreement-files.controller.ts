import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IsBoolean, IsIn, IsInt, IsString, Length, Min } from "class-validator";
import type { FastifyRequest } from "fastify";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { withUploadedBinary } from "../common/http/upload-capacity";
import { ClientAgreementFilesService } from "./client-agreement-files.service";

export class ReviewAgreementFileDto {
  @IsInt() @Min(1) version!: number;
  @IsIn(["APPROVED", "REJECTED"]) status!: string;
  @IsString() @Length(10, 1000) notes!: string;
  @IsBoolean() signaturesChecked!: boolean;
}
@Controller("clients/:clientId/agreements/:agreementId/files")
@RequireRoles("PLATFORM_ADMIN", "SALES_MANAGER")
export class ClientAgreementFilesController {
  constructor(
    private readonly files: ClientAgreementFilesService,
    private readonly config: ConfigService,
  ) {}
  @Get()
  @RequirePermissions(Permission.ClientRead)
  list(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Param("agreementId", ParseUUIDPipe) agreementId: string,
  ) {
    return this.files.list(actor, clientId, agreementId);
  }
  @Post()
  @RequirePermissions(Permission.ClientWrite)
  upload(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Param("agreementId", ParseUUIDPipe) agreementId: string,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `${actor.tenantPublicId}:${actor.userPublicId}`,
      (file) => this.files.upload(actor, clientId, agreementId, file),
    );
  }
  @Patch(":fileId")
  @RequirePermissions(Permission.ClientWrite)
  review(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Param("agreementId", ParseUUIDPipe) agreementId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
    @Body() input: ReviewAgreementFileDto,
  ) {
    return this.files.review(actor, clientId, agreementId, fileId, input);
  }
  @Get(":fileId/content")
  @Header("Cache-Control", "private, no-store")
  @RequirePermissions(Permission.ClientRead)
  download(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Param("agreementId", ParseUUIDPipe) agreementId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return this.files.download(actor, clientId, agreementId, fileId);
  }
}

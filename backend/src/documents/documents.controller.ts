import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  ParseUUIDPipe,
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
import { CreateDocumentDto } from "./dto/create-document.dto";
import { DocumentsService } from "./documents.service";
import { DocumentReviewService } from "./document-review.service";
import { ReviewDocumentDto } from "./dto/review-document.dto";

@Controller()
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly config: ConfigService,
    private readonly reviews: DocumentReviewService,
  ) {}

  @Get("cases/:caseId/evidence-readiness")
  @RequirePermissions(Permission.DocumentRead)
  readiness(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.reviews.readiness(actor, caseId);
  }

  @Patch("documents/:documentId/review")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER", "QA_REVIEWER")
  @RequirePermissions(Permission.DocumentRead)
  review(
    @CurrentActor() actor: Actor,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Body() input: ReviewDocumentDto,
  ) {
    return this.reviews.review(actor, documentId, input);
  }

  @Post("cases/:caseId/documents")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "CLIENT_ADMIN")
  @RequirePermissions(Permission.DocumentWrite)
  create(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: CreateDocumentDto,
  ) {
    return this.documents.create(actor, caseId, input);
  }

  @Post("documents/:documentId/content")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "CLIENT_ADMIN")
  @RequirePermissions(Permission.DocumentWrite)
  async upload(
    @CurrentActor() actor: Actor,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Req() request: FastifyRequest,
  ) {
    return withUploadedBinary(
      request,
      this.config,
      `${actor.tenantPublicId}:${actor.userPublicId}`,
      (file) => this.documents.upload(actor, documentId, file),
    );
  }

  @Get("documents/:documentId/content")
  @Header("Cache-Control", "private, no-store")
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "CLIENT_ADMIN",
    "VERIFIER",
    "QA_REVIEWER",
  )
  @RequirePermissions(Permission.DocumentRead)
  async download(
    @CurrentActor() actor: Actor,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ): Promise<StreamableFile> {
    return (await this.documents.download(actor, documentId)).file;
  }

  @Get("documents/:documentId/preview")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "CLIENT_ADMIN",
    "VERIFIER",
    "QA_REVIEWER",
  )
  @RequirePermissions(Permission.DocumentRead)
  async preview(
    @CurrentActor() actor: Actor,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ): Promise<StreamableFile> {
    return (await this.documents.download(actor, documentId, "preview")).file;
  }
}

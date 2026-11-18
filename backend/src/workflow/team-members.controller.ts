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
  StreamableFile,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import type { FastifyRequest } from "fastify";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { ResetUserPasswordDto } from "../users/dto/reset-user-password.dto";
import { UserIdentityDto } from "../users/dto/user-identity.dto";
import { TeamMembersService } from "./team-members.service";
import { TeamMemberDocumentsService } from "./team-member-documents.service";
import { parseTeamMemberMultipart } from "./team-member-documents";

export class CreateTeamMemberDto extends UserIdentityDto {
  @IsUUID() departmentId!: string;
  /** Narrowed access (a subset of the team role); omitted = full access. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  permissions?: string[];
}

export class SetTeamMemberStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED"]) status!: "ACTIVE" | "SUSPENDED";
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

/** Team Leader: the people in the teams it leads (create, suspend, reset password, docs). */
@Controller("workflow/team/members")
@RequireRoles("VERIFIER", "DATA_ENTRY")
export class TeamMembersController {
  constructor(
    private readonly members: TeamMembersService,
    private readonly memberDocs: TeamMemberDocumentsService,
  ) {}

  @Get()
  overview(@CurrentActor() actor: Actor) {
    return this.members.overview(actor);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentActor() actor: Actor, @Body() input: CreateTeamMemberDto) {
    return this.members.create(actor, input);
  }

  @Post("with-documents")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createWithDocuments(
    @CurrentActor() actor: Actor,
    @Req() request: FastifyRequest,
  ) {
    const payload = await parseTeamMemberMultipart(request);
    return this.memberDocs.createWithDocuments(actor, payload);
  }

  @Get(":userId/documents")
  listDocuments(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.memberDocs.listDocuments(actor, userId);
  }

  @Get(":userId/documents/:docId/preview")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async previewDocument(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Param("docId", ParseUUIDPipe) docId: string,
  ): Promise<StreamableFile> {
    const doc = await this.memberDocs.getDocumentForDownload(actor, userId, docId);
    return new StreamableFile(doc.stream, {
      type: doc.mimeType,
      disposition: `inline; filename="${encodeURIComponent(doc.fileName)}"`,
    });
  }

  @Get(":userId/documents/:docId/download")
  @Header("Cache-Control", "private, no-store")
  async downloadDocument(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Param("docId", ParseUUIDPipe) docId: string,
  ): Promise<StreamableFile> {
    const doc = await this.memberDocs.getDocumentForDownload(actor, userId, docId);
    return new StreamableFile(doc.stream, {
      type: doc.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
    });
  }

  @Patch(":userId/status")
  setStatus(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: SetTeamMemberStatusDto,
  ) {
    return this.members.setStatus(actor, userId, input);
  }

  @Post(":userId/reset-password")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(
    @CurrentActor() actor: Actor,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: ResetUserPasswordDto,
  ) {
    return this.members.resetPassword(actor, userId, input.temporaryPassword);
  }
}

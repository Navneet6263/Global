import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { reentryCaseWhere } from "../clarifications/clarification-l2-reentry.helpers";
import { documentScope } from "../verification/check-documents";
import { assertCandidateDocumentType } from "./candidate-document-policy";
import { ContentInspectionService } from "./content-inspection.service";
import {
  type CandidateAccessTarget,
  type DocumentUploadOptions,
  executeCandidateDocumentUpload,
  executeTeamDocumentUpload,
} from "./document-upload-flows";
import type { CreateDocumentDto } from "./dto/create-document.dto";
import { LocalObjectStorageService } from "./local-object-storage.service";
import {
  DOCUMENT_UPLOAD_ALLOWED_CASE_STATUSES,
  documentExpiry,
} from "./upload-document-policy";

export { DOCUMENT_UPLOAD_ALLOWED_CASE_STATUSES };
export type { DocumentUploadOptions };

export interface DocumentStreamAccess {
  caseScope?: Prisma.VerificationCaseWhereInput;
  version?: number;
}

export function assertDocumentUploadAllowed(status: string) {
  if (!DOCUMENT_UPLOAD_ALLOWED_CASE_STATUSES.has(status)) {
    throw new ConflictException(
      `Documents cannot be changed while the case is ${status.toLowerCase().replaceAll("_", " ")}`,
    );
  }
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly inspection: ContentInspectionService,
    private readonly storage: LocalObjectStorageService,
  ) {}

  async create(actor: Actor, casePublicId: string, input: CreateDocumentDto) {
    const verificationCase = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: { id: true, status: true },
    });
    if (!verificationCase) throw new NotFoundException("Case not found");
    assertDocumentUploadAllowed(verificationCase.status);
    const existing = await this.prisma.document.findFirst({
      where: { tenantId: actor.tenantId, caseId: verificationCase.id, type: input.type },
      orderBy: { createdAt: "desc" },
      select: { publicId: true, type: true, status: true, currentVersion: true, createdAt: true },
    });
    if (existing) return { id: existing.publicId, ...existing, publicId: undefined };
    const document = await this.prisma.document.create({
      data: {
        tenantId: actor.tenantId,
        caseId: verificationCase.id,
        type: input.type,
        expiresAt: input.expiresAt ? documentExpiry(input.expiresAt) : undefined,
      },
      select: { publicId: true, type: true, status: true, currentVersion: true, createdAt: true },
    });
    return { id: document.publicId, ...document, publicId: undefined };
  }

  async upload(
    actor: Actor,
    publicId: string,
    file: UploadedBinary,
    options?: DocumentUploadOptions,
  ) {
    if (!file) throw new BadRequestException("A document file is required");
    const document = await this.prisma.document.findFirst({
      where: { tenantId: actor.tenantId, publicId, case: caseAccessScope(actor) },
      include: {
        case: { select: { id: true, publicId: true, status: true } },
        tenant: { select: { publicId: true } },
      },
    });
    if (!document) throw new NotFoundException("Document not found");
    assertDocumentUploadAllowed(document.case.status);
    await this.inspection.inspect(
      file,
      this.config.get<number>("UPLOAD_MAX_BYTES", 10_485_760),
      { documentType: document.type },
    );
    return executeTeamDocumentUpload(
      { prisma: this.prisma, storage: this.storage, logger: this.logger },
      actor,
      document,
      file,
      options,
    );
  }

  /**
   * `access` lets callers override caseScope or pin a specific version.
   * When `access?.version` is omitted, defaults to accepted `currentVersion` when present.
   */
  async download(
    actor: Actor,
    publicId: string,
    mode: "download" | "preview" = "download",
    access?: DocumentStreamAccess,
  ) {
    const baseWhere = {
      document: {
        publicId,
        tenantId: actor.tenantId,
        case: access?.caseScope ?? caseAccessScope(actor),
        ...(access?.caseScope ? {} : documentScope(actor)),
      },
      malwareState: "CLEAN",
    };
    const select = {
      objectKey: true,
      originalName: true,
      contentType: true,
      version: true,
      document: {
        select: {
          type: true,
          currentVersion: true,
          case: { select: { publicId: true, caseNumber: true } },
        },
      },
    };
    let version = await this.prisma.documentVersion.findFirst({
      where: {
        ...baseWhere,
        ...(access?.version !== undefined ? { version: access.version } : {}),
      },
      orderBy: { version: "desc" },
      select,
    });
    if (
      access?.version === undefined &&
      version &&
      typeof version.document.currentVersion === "number" &&
      version.document.currentVersion > 0 &&
      version.version !== version.document.currentVersion
    ) {
      const current = await this.prisma.documentVersion.findFirst({
        where: { ...baseWhere, version: version.document.currentVersion },
        orderBy: { version: "desc" },
        select,
      });
      if (current) version = current;
    }
    if (
      !version &&
      !access?.caseScope &&
      actor.roles.includes("DATA_ENTRY") &&
      !actor.roles.some((role) =>
        ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
      )
    ) {
      const l2BaseWhere = {
        document: {
          publicId,
          tenantId: actor.tenantId,
          case: {
            ...reentryCaseWhere(actor),
            clarifications: {
              some: {
                level: "L2",
                status: "DATA_ENTRY_PENDING",
                submittedDocumentId: { not: null },
              },
            },
          },
        },
        malwareState: "CLEAN",
      };
      version = await this.prisma.documentVersion.findFirst({
        where: {
          ...l2BaseWhere,
          ...(access?.version !== undefined ? { version: access.version } : {}),
        },
        orderBy: { version: "desc" },
        select,
      });
      if (
        access?.version === undefined &&
        version &&
        typeof version.document.currentVersion === "number" &&
        version.document.currentVersion > 0 &&
        version.version !== version.document.currentVersion
      ) {
        const current = await this.prisma.documentVersion.findFirst({
          where: { ...l2BaseWhere, version: version.document.currentVersion },
          orderBy: { version: "desc" },
          select,
        });
        if (current) version = current;
      }
    }
    if (!version) throw new NotFoundException("A safe document version is not available");
    if (
      mode === "preview" &&
      !["application/pdf", "image/jpeg", "image/png"].includes(version.contentType)
    ) {
      throw new BadRequestException("Preview is available for PDF, JPEG and PNG documents only");
    }
    const contents = await this.storage.auditedStream(version.objectKey, () =>
      this.prisma.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: mode === "preview" ? "document.previewed" : "document.downloaded",
          resourceType: "document",
          resourcePublicId: publicId,
          afterJson: JSON.stringify({
            caseId: version.document.case.publicId,
            caseNumber: version.document.case.caseNumber,
            documentType: version.document.type,
            version: version.version,
          }),
        },
      }),
    );
    return {
      file: new StreamableFile(contents, {
        type: version.contentType,
        disposition: `${mode === "preview" ? "inline" : "attachment"}; filename="${this.safeName(version.originalName)}"`,
      }),
    };
  }

  async uploadForCandidate(
    access: CandidateAccessTarget,
    type: string,
    file: UploadedBinary,
    expiry?: string,
    options?: DocumentUploadOptions,
  ) {
    assertDocumentUploadAllowed(access.caseStatus);
    await assertCandidateDocumentType(this.prisma, access.caseId, type);
    await this.inspection.inspect(
      file,
      this.config.get<number>("UPLOAD_MAX_BYTES", 10_485_760),
      { documentType: type },
    );
    return executeCandidateDocumentUpload(
      { prisma: this.prisma, storage: this.storage, logger: this.logger },
      access,
      type,
      file,
      documentExpiry(expiry),
      options,
    );
  }

  private safeName(name: string): string {
    return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  }
}

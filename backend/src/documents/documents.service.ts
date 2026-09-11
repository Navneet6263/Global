import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { PrismaService } from "../database/prisma.service";
import { ContentInspectionService } from "./content-inspection.service";
import type { CreateDocumentDto } from "./dto/create-document.dto";
import { LocalObjectStorageService } from "./local-object-storage.service";
import {
  assertNotDuplicateDocument,
  documentExpiry,
  lockMutableCaseEvidence,
} from "./upload-document-policy";
import { CANDIDATE_PRIVACY_NOTICE } from "./candidate-privacy-notice";
import { assertCandidateDocumentType } from "./candidate-document-policy";

export const DOCUMENT_UPLOAD_ALLOWED_CASE_STATUSES = new Set([
  "DRAFT",
  "CONSENT_PENDING",
  "DOCUMENT_PENDING",
  "IN_PROGRESS",
  "CLARIFICATION_PENDING",
]);

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
      where: {
        ...caseAccessScope(actor),
        publicId: casePublicId,
      },
      select: { id: true, status: true },
    });
    if (!verificationCase) throw new NotFoundException("Case not found");
    assertDocumentUploadAllowed(verificationCase.status);
    const existing = await this.prisma.document.findFirst({
      where: {
        tenantId: actor.tenantId,
        caseId: verificationCase.id,
        type: input.type,
      },
      orderBy: { createdAt: "desc" },
      select: {
        publicId: true,
        type: true,
        status: true,
        currentVersion: true,
        createdAt: true,
      },
    });
    if (existing)
      return { id: existing.publicId, ...existing, publicId: undefined };
    const document = await this.prisma.document.create({
      data: {
        tenantId: actor.tenantId,
        caseId: verificationCase.id,
        type: input.type,
        expiresAt: input.expiresAt
          ? documentExpiry(input.expiresAt)
          : undefined,
      },
      select: {
        publicId: true,
        type: true,
        status: true,
        currentVersion: true,
        createdAt: true,
      },
    });
    return { id: document.publicId, ...document, publicId: undefined };
  }

  async upload(actor: Actor, publicId: string, file: UploadedBinary) {
    if (!file) throw new BadRequestException("A document file is required");
    const document = await this.prisma.document.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        case: caseAccessScope(actor),
      },
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
    const version = document.currentVersion + 1;
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    await assertNotDuplicateDocument(
      this.prisma,
      actor.tenantId,
      document.case.id,
      sha256,
    );
    const objectKey = `${document.tenant.publicId}/${document.case.publicId}/${document.publicId}/v${version}-${randomUUID()}`;
    await this.storage.put(objectKey, file.buffer);

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await lockMutableCaseEvidence(tx, document.case.id);
        await assertNotDuplicateDocument(
          tx,
          actor.tenantId,
          document.case.id,
          sha256,
        );
        const updated = await tx.document.updateMany({
          where: {
            id: document.id,
            currentVersion: document.currentVersion,
            version: document.version,
          },
          data: {
            currentVersion: version,
            status: "AVAILABLE",
            version: { increment: 1 },
            reviewedAt: null,
            reviewedById: null,
            reviewNote: null,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            "A document version was uploaded concurrently; refresh and try again",
          );
        }
        const created = await tx.documentVersion.create({
          data: {
            documentId: document.id,
            version,
            objectKey,
            originalName: file.originalName.slice(0, 255),
            contentType: file.mimetype,
            sizeBytes: BigInt(file.size),
            sha256,
            malwareState: "CLEAN",
            uploadedById: actor.userId,
          },
          select: {
            version: true,
            originalName: true,
            contentType: true,
            sizeBytes: true,
            sha256: true,
            malwareState: true,
            createdAt: true,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "document.uploaded",
            resourceType: "document",
            resourcePublicId: publicId,
            afterJson: JSON.stringify({
              version,
              sha256,
              sizeBytes: file.size,
            }),
          },
        });
        return created;
      });
    } catch (error) {
      await this.deleteIfUnreferenced(objectKey);
      throw error;
    }
    return { ...result, sizeBytes: result.sizeBytes.toString() };
  }

  async download(
    actor: Actor,
    publicId: string,
    mode: "download" | "preview" = "download",
  ) {
    const version = await this.prisma.documentVersion.findFirst({
      where: {
        document: {
          publicId,
          tenantId: actor.tenantId,
          case: caseAccessScope(actor),
        },
        malwareState: "CLEAN",
      },
      orderBy: { version: "desc" },
      select: {
        objectKey: true,
        originalName: true,
        contentType: true,
        version: true,
        document: {
          select: {
            type: true,
            case: { select: { publicId: true, caseNumber: true } },
          },
        },
      },
    });
    if (!version)
      throw new NotFoundException("A safe document version is not available");
    if (
      mode === "preview" &&
      !["application/pdf", "image/jpeg", "image/png"].includes(
        version.contentType,
      )
    ) {
      throw new BadRequestException(
        "Preview is available for PDF, JPEG and PNG documents only",
      );
    }
    const contents = await this.storage.auditedStream(version.objectKey, () =>
      this.prisma.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action:
            mode === "preview" ? "document.previewed" : "document.downloaded",
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
    access: {
      tenantId: bigint;
      tenantPublicId: string;
      caseId: bigint;
      casePublicId: string;
      caseStatus: string;
    },
    type: string,
    file: UploadedBinary,
    expiry?: string,
  ) {
    assertDocumentUploadAllowed(access.caseStatus);
    await assertCandidateDocumentType(this.prisma, access.caseId, type);
    await this.inspection.inspect(
      file,
      this.config.get<number>("UPLOAD_MAX_BYTES", 10_485_760),
      { documentType: type },
    );
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const expiresAt = documentExpiry(expiry);
    await assertNotDuplicateDocument(
      this.prisma,
      access.tenantId,
      access.caseId,
      sha256,
    );
    const document = await this.prisma.document.findFirst({
      where: { tenantId: access.tenantId, caseId: access.caseId, type },
      orderBy: { createdAt: "desc" },
      select: { id: true, publicId: true, currentVersion: true, version: true },
    });
    const target =
      document ??
      (await this.prisma.$transaction(async (tx) => {
        await lockMutableCaseEvidence(tx, access.caseId);
        return tx.document.create({
          data: {
            tenantId: access.tenantId,
            caseId: access.caseId,
            type,
            expiresAt,
          },
          select: {
            id: true,
            publicId: true,
            currentVersion: true,
            version: true,
          },
        });
      }));
    const version = target.currentVersion + 1;
    const objectKey = `${access.tenantPublicId}/${access.casePublicId}/${target.publicId}/v${version}-${randomUUID()}`;
    await this.storage.put(objectKey, file.buffer);
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockMutableCaseEvidence(tx, access.caseId);
        await assertNotDuplicateDocument(
          tx,
          access.tenantId,
          access.caseId,
          sha256,
        );
        const updated = await tx.document.updateMany({
          where: {
            id: target.id,
            currentVersion: target.currentVersion,
            version: target.version,
          },
          data: {
            currentVersion: version,
            status: "AVAILABLE",
            version: { increment: 1 },
            reviewedAt: null,
            reviewedById: null,
            reviewNote: null,
            expiresAt: expiresAt ?? null,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            "A document version was uploaded concurrently; refresh and try again",
          );
        }
        await tx.documentVersion.create({
          data: {
            documentId: target.id,
            version,
            objectKey,
            originalName: file.originalName.slice(0, 255),
            contentType: file.mimetype,
            sizeBytes: BigInt(file.size),
            sha256,
            malwareState: "CLEAN",
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: access.tenantId,
            action: "document.candidate-uploaded",
            resourceType: "document",
            resourcePublicId: target.publicId,
            afterJson: JSON.stringify({
              version,
              sha256,
              sizeBytes: file.size,
              privacyNoticeVersion: CANDIDATE_PRIVACY_NOTICE.version,
            }),
          },
        });
      });
    } catch (error) {
      await this.deleteIfUnreferenced(objectKey);
      throw error;
    }
    return {
      id: target.publicId,
      type,
      version,
      sha256,
      malwareState: "CLEAN",
    };
  }

  private safeName(name: string): string {
    return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  }

  private async deleteIfUnreferenced(objectKey: string): Promise<void> {
    try {
      const referenced = await this.prisma.documentVersion.findFirst({
        where: { objectKey },
        select: { id: true },
      });
      if (!referenced) await this.storage.delete(objectKey);
    } catch (error) {
      this.logger.warn(
        `Deferred unreferenced document cleanup: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}

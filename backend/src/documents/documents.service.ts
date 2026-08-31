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
    const document = await this.prisma.document.create({
      data: {
        tenantId: actor.tenantId,
        caseId: verificationCase.id,
        type: input.type,
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
        case: { select: { publicId: true, status: true } },
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
    const objectKey = `${document.tenant.publicId}/${document.case.publicId}/${document.publicId}/v${version}-${randomUUID()}`;
    await this.storage.put(objectKey, file.buffer);

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.document.updateMany({
          where: { id: document.id, currentVersion: document.currentVersion },
          data: { currentVersion: version, status: "AVAILABLE" },
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

  async download(actor: Actor, publicId: string) {
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
      select: { objectKey: true, originalName: true, contentType: true },
    });
    if (!version)
      throw new NotFoundException("A safe document version is not available");
    const contents = await this.storage.get(version.objectKey);
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "document.downloaded",
        resourceType: "document",
        resourcePublicId: publicId,
      },
    });
    return {
      file: new StreamableFile(contents, {
        type: version.contentType,
        disposition: `attachment; filename="${this.safeName(version.originalName)}"`,
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
  ) {
    assertDocumentUploadAllowed(access.caseStatus);
    const allowed = new Set([
      "AADHAAR",
      "PAN",
      "PASSPORT",
      "DRIVING_LICENCE",
      "ADDRESS_PROOF",
      "EDUCATION_CERTIFICATE",
      "EMPLOYMENT_PROOF",
    ]);
    if (!allowed.has(type))
      throw new BadRequestException("Unsupported document type");
    await this.inspection.inspect(
      file,
      this.config.get<number>("UPLOAD_MAX_BYTES", 10_485_760),
      { documentType: type },
    );
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const document = await this.prisma.document.findFirst({
      where: { tenantId: access.tenantId, caseId: access.caseId, type },
      orderBy: { createdAt: "desc" },
      select: { id: true, publicId: true, currentVersion: true },
    });
    const target =
      document ??
      (await this.prisma.document.create({
        data: { tenantId: access.tenantId, caseId: access.caseId, type },
        select: { id: true, publicId: true, currentVersion: true },
      }));
    const version = target.currentVersion + 1;
    const objectKey = `${access.tenantPublicId}/${access.casePublicId}/${target.publicId}/v${version}-${randomUUID()}`;
    await this.storage.put(objectKey, file.buffer);
    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.document.updateMany({
          where: { id: target.id, currentVersion: target.currentVersion },
          data: { currentVersion: version, status: "AVAILABLE" },
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

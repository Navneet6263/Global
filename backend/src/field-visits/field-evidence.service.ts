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
import { ContentInspectionService } from "../documents/content-inspection.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";

@Injectable()
export class FieldEvidenceService {
  private readonly logger = new Logger(FieldEvidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: LocalObjectStorageService,
    private readonly inspection: ContentInspectionService,
  ) {}

  async add(
    actor: Actor,
    visitPublicId: string,
    file: UploadedBinary,
    capturedAt?: string,
    clientEvidenceId?: string,
  ) {
    if (!file) throw new BadRequestException("An evidence image is required");
    if (
      clientEvidenceId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        clientEvidenceId,
      )
    ) {
      throw new BadRequestException("Evidence identifier is invalid");
    }
    const evidenceCapturedAt = capturedAt ? new Date(capturedAt) : new Date();
    if (Number.isNaN(evidenceCapturedAt.getTime())) {
      throw new BadRequestException("Evidence capture time is invalid");
    }
    const visit = await this.prisma.fieldVisit.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: visitPublicId,
        assigneeId: actor.userId,
        ...(actor.branchId || actor.clientId
          ? {
              case: {
                ...(actor.branchId ? { branchId: actor.branchId } : {}),
                ...(actor.clientId ? { clientId: actor.clientId } : {}),
              },
            }
          : {}),
      },
      include: {
        tenant: { select: { publicId: true } },
        case: { select: { publicId: true } },
      },
    });
    if (!visit) throw new NotFoundException("Assigned field visit not found");
    if (clientEvidenceId) {
      const existing = await this.prisma.evidenceItem.findFirst({
        where: {
          publicId: clientEvidenceId,
          fieldVisitId: visit.id,
          uploadedById: actor.userId,
        },
        select: {
          publicId: true,
          type: true,
          sha256: true,
          capturedAt: true,
          createdAt: true,
        },
      });
      if (existing) {
        return { id: existing.publicId, ...existing, publicId: undefined };
      }
    }
    if (!["ASSIGNED", "IN_PROGRESS"].includes(visit.status)) {
      throw new BadRequestException("This visit is not accepting new evidence");
    }
    if (
      evidenceCapturedAt < new Date(visit.evidenceSince.getTime() - 5 * 60_000)
    ) {
      throw new BadRequestException(
        "Evidence was captured before this visit attempt began",
      );
    }
    if (evidenceCapturedAt > new Date(Date.now() + 5 * 60_000)) {
      throw new BadRequestException(
        "Evidence capture time cannot be in the future",
      );
    }
    if (!file.mimetype.startsWith("image/")) {
      throw new BadRequestException("Field evidence must be an image");
    }
    await this.inspection.inspect(
      file,
      this.config.get<number>("UPLOAD_MAX_BYTES", 10_485_760),
    );

    const publicId = clientEvidenceId ?? randomUUID();
    const objectKey = `${visit.tenant.publicId}/${visit.case.publicId}/visits/${visit.publicId}/${publicId}`;
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    await this.storage.put(objectKey, file.buffer);
    let evidence;
    try {
      evidence = await this.prisma.$transaction(async (tx) => {
        const accepting = await tx.fieldVisit.updateMany({
          where: {
            id: visit.id,
            status: { in: ["ASSIGNED", "IN_PROGRESS"] },
          },
          data: { status: "IN_PROGRESS" },
        });
        if (accepting.count !== 1) {
          throw new ConflictException(
            "This visit stopped accepting evidence; refresh and try again",
          );
        }
        const created = await tx.evidenceItem.create({
          data: {
            publicId,
            fieldVisitId: visit.id,
            uploadedById: actor.userId,
            type: "PHOTO",
            objectKey,
            contentType: file.mimetype,
            sizeBytes: BigInt(file.size),
            sha256,
            capturedAt: evidenceCapturedAt,
          },
          select: {
            publicId: true,
            type: true,
            sha256: true,
            capturedAt: true,
            createdAt: true,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "field_evidence.uploaded",
            resourceType: "field_visit",
            resourcePublicId: visitPublicId,
            afterJson: JSON.stringify({
              evidenceId: publicId,
              sha256,
              capturedAt: evidenceCapturedAt,
            }),
          },
        });
        return created;
      });
    } catch (error) {
      await this.deleteIfUnreferenced(objectKey);
      throw error;
    }
    return { id: evidence.publicId, ...evidence, publicId: undefined };
  }

  async download(actor: Actor, evidencePublicId: string) {
    const fieldExecutive = actor.roles.includes("FIELD_EXECUTIVE");
    const evidence = await this.prisma.evidenceItem.findFirst({
      where: {
        publicId: evidencePublicId,
        fieldVisit: {
          tenantId: actor.tenantId,
          ...(fieldExecutive
            ? {
                assigneeId: actor.userId,
                ...(actor.branchId || actor.clientId
                  ? {
                      case: {
                        ...(actor.branchId ? { branchId: actor.branchId } : {}),
                        ...(actor.clientId ? { clientId: actor.clientId } : {}),
                      },
                    }
                  : {}),
              }
            : { case: caseAccessScope(actor) }),
        },
      },
      select: {
        objectKey: true,
        contentType: true,
        type: true,
        fieldVisit: { select: { publicId: true } },
      },
    });
    if (!evidence) throw new NotFoundException("Field evidence not found");
    const contents = await this.storage.auditedStream(evidence.objectKey, () =>
      this.prisma.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "field_evidence.viewed",
          resourceType: "field_evidence",
          resourcePublicId: evidencePublicId,
          afterJson: JSON.stringify({
            fieldVisitId: evidence.fieldVisit.publicId,
          }),
        },
      }),
    );
    return new StreamableFile(contents, {
      type: evidence.contentType,
      disposition: `inline; filename="field-${evidence.type.toLowerCase()}-${evidencePublicId}.jpg"`,
    });
  }

  private async deleteIfUnreferenced(objectKey: string): Promise<void> {
    try {
      const referenced = await this.prisma.evidenceItem.findFirst({
        where: { objectKey },
        select: { id: true },
      });
      if (!referenced) await this.storage.delete(objectKey);
    } catch (error) {
      this.logger.warn(
        `Deferred unreferenced evidence cleanup: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}

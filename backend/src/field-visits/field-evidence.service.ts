import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
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
  ) {
    if (!file) throw new BadRequestException("An evidence image is required");
    const evidenceCapturedAt = capturedAt ? new Date(capturedAt) : new Date();
    if (Number.isNaN(evidenceCapturedAt.getTime())) {
      throw new BadRequestException("Evidence capture time is invalid");
    }
    const visit = await this.prisma.fieldVisit.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: visitPublicId,
        assigneeId: actor.userId,
      },
      include: {
        tenant: { select: { publicId: true } },
        case: { select: { publicId: true } },
      },
    });
    if (!visit) throw new NotFoundException("Assigned field visit not found");
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

    const publicId = randomUUID();
    const objectKey = `${visit.tenant.publicId}/${visit.case.publicId}/visits/${visit.publicId}/${publicId}`;
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    await this.storage.put(objectKey, file.buffer);
    let evidence;
    try {
      evidence = await this.prisma.$transaction(async (tx) => {
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
        await tx.fieldVisit.updateMany({
          where: { id: visit.id, status: "ASSIGNED" },
          data: { status: "IN_PROGRESS" },
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

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { PrismaService } from "../database/prisma.service";
import { ContentInspectionService } from "../documents/content-inspection.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";

const fileSelect = {
  publicId: true,
  revision: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  status: true,
  uploadedById: true,
  reviewedAt: true,
  reviewNotes: true,
  version: true,
  createdAt: true,
} as const;

@Injectable()
export class ClientAgreementFilesService {
  private readonly logger = new Logger(ClientAgreementFilesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly inspection: ContentInspectionService,
    private readonly storage: LocalObjectStorageService,
  ) {}
  async agreement(actor: Actor, clientId: string, agreementId: string) {
    const row = await this.prisma.clientAgreement.findFirst({
      where: {
        publicId: agreementId,
        client: {
          tenantId: actor.tenantId,
          publicId: clientId,
          ...(actor.clientId ? { id: actor.clientId } : {}),
        },
      },
      include: { client: { select: { id: true, version: true } } },
    });
    if (!row) throw new NotFoundException("Client agreement not found");
    return row;
  }
  async list(actor: Actor, clientId: string, agreementId: string) {
    const agreement = await this.agreement(actor, clientId, agreementId);
    const rows = await this.prisma.clientAgreementFile.findMany({
      where: { agreementId: agreement.id },
      orderBy: { revision: "desc" },
      take: 30,
      select: fileSelect,
    });
    return {
      items: rows.map(({ publicId, uploadedById, ...row }) => ({
        id: publicId,
        ...row,
        isUploader: uploadedById === actor.userId,
      })),
    };
  }
  async upload(
    actor: Actor,
    clientId: string,
    agreementId: string,
    file: UploadedBinary,
  ) {
    const agreement = await this.agreement(actor, clientId, agreementId);
    await this.inspection.inspect(file, 10_485_760, { documentType: "OTHER" });
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const key = `${actor.tenantPublicId}/commercial/${clientId}/${agreementId}/${randomUUID()}`;
    await this.storage.put(key, file.buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const lock = await tx.client.updateMany({
          where: { id: agreement.client.id, version: agreement.client.version },
          data: { version: { increment: 1 } },
        });
        if (!lock.count)
          throw new ConflictException(
            "Client changed; refresh before uploading",
          );
        const latest = await tx.clientAgreementFile.findFirst({
          where: { agreementId: agreement.id },
          orderBy: { revision: "desc" },
          select: { revision: true },
        });
        if ((latest?.revision ?? 0) >= 30)
          throw new BadRequestException(
            "Maximum 30 revisions; create a new agreement reference",
          );
        if (
          await tx.clientAgreementFile.count({
            where: { agreementId: agreement.id, sha256 },
          })
        )
          throw new ConflictException(
            "This exact file is already in this agreement's history",
          );
        const row = await tx.clientAgreementFile.create({
          data: {
            agreementId: agreement.id,
            revision: (latest?.revision ?? 0) + 1,
            objectKey: key,
            originalName: file.originalName.slice(0, 255),
            mimeType: file.mimetype,
            sizeBytes: file.size,
            sha256,
            uploadedById: actor.userId,
          },
          select: { publicId: true, revision: true },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "client.agreement-file.uploaded",
            resourceType: "client",
            resourcePublicId: clientId,
            afterJson: JSON.stringify({
              agreementId,
              fileId: row.publicId,
              revision: row.revision,
              sha256,
            }),
          },
        });
        return { id: row.publicId, revision: row.revision };
      });
    } catch (error) {
      // A timeout can leave an uncertain commit. Never delete a referenced file.
      const referenced = await this.prisma.clientAgreementFile
        .count({ where: { objectKey: key } })
        .catch(() => 1);
      if (!referenced) {
        try {
          await this.storage.delete(key);
        } catch {
          // Only this new, unreferenced object is eligible; never erase a saved original.
          try {
            await this.prisma.outboxEvent.create({
              data: {
                tenantId: actor.tenantId,
                topic: "object.delete.requested",
                aggregateType: "client",
                aggregateId: clientId,
                payloadJson: JSON.stringify({ objectKey: key }),
              },
            });
          } catch {
            this.logger.error(
              `Uncommitted agreement object cleanup needs reconciliation: ${key}`,
            );
          }
        }
      }
      throw error;
    }
  }
  async review(
    actor: Actor,
    clientId: string,
    agreementId: string,
    fileId: string,
    input: {
      version: number;
      status: string;
      notes: string;
      signaturesChecked: boolean;
    },
  ) {
    const agreement = await this.agreement(actor, clientId, agreementId);
    if (input.notes.trim().length < 10)
      throw new BadRequestException("Record the review rationale");
    if (
      input.status === "APPROVED" &&
      (!input.signaturesChecked ||
        !agreement.signedAt ||
        agreement.signedAt > new Date() ||
        (agreement.expiresAt && agreement.expiresAt <= new Date()))
    )
      throw new BadRequestException(
        "Review signatures and record a current signing/expiry date before approval",
      );
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.client.updateMany({
        where: { id: agreement.client.id, version: agreement.client.version },
        data: { version: { increment: 1 } },
      });
      if (!lock.count)
        throw new ConflictException("Client changed; refresh before reviewing");
      const row = await tx.clientAgreementFile.findFirst({
        where: { agreementId: agreement.id },
        orderBy: { revision: "desc" },
      });
      if (!row || row.publicId !== fileId)
        throw new ConflictException("Review the latest uploaded revision");
      if (row.uploadedById === actor.userId)
        throw new ForbiddenException(
          "A different authorised colleague must review this file",
        );
      const changed = await tx.clientAgreementFile.updateMany({
        where: { id: row.id, version: input.version, status: "PENDING" },
        data: {
          status: input.status,
          reviewNotes: input.notes.trim(),
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new ConflictException(
          "Agreement review changed or is already final",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.agreement-file.reviewed",
          resourceType: "client",
          resourcePublicId: clientId,
          afterJson: JSON.stringify({
            agreementId,
            fileId,
            status: input.status,
            notes: input.notes.trim(),
            signaturesChecked: input.signaturesChecked,
          }),
        },
      });
      return { status: input.status, version: input.version + 1 };
    });
  }
  async download(
    actor: Actor,
    clientId: string,
    agreementId: string,
    fileId: string,
  ) {
    const agreement = await this.agreement(actor, clientId, agreementId);
    const file = await this.prisma.clientAgreementFile.findFirst({
      where: { publicId: fileId, agreementId: agreement.id },
    });
    if (!file) throw new NotFoundException("Agreement file not found");
    const stream = await this.storage.auditedStream(file.objectKey, () =>
      this.prisma.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.agreement-file.downloaded",
          resourceType: "client",
          resourcePublicId: clientId,
          afterJson: JSON.stringify({ agreementId, fileId }),
        },
      }),
    );
    return new StreamableFile(stream, {
      type: file.mimeType,
      disposition: `attachment; filename="agreement-r${file.revision}.${file.mimeType === "application/pdf" ? "pdf" : file.mimeType === "image/png" ? "png" : "jpg"}"`,
    });
  }
}

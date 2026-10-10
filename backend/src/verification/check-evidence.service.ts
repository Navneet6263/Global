import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { PrismaService } from "../database/prisma.service";
import { ContentInspectionService } from "../documents/content-inspection.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";

/** Proof per check: PDF or images, 8 MB each, at most 15 files. */
export const CHECK_EVIDENCE_TYPES: readonly string[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];
export const CHECK_EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;
export const CHECK_EVIDENCE_MAX_FILES = 15;

const SUPERVISORS = ["PLATFORM_ADMIN", "OPS_MANAGER"];
const OPEN_CASE = ["IN_PROGRESS", "CLARIFICATION_PENDING"];

type EvidenceCheck = {
  id: bigint;
  publicId: string;
  status: string;
  departmentId: bigint | null;
  case: { publicId: string; status: string; assignedOpsUserId: bigint | null };
  tasks: Array<{ assigneeId: bigint | null; status: string }>;
};

/**
 * Proof a verifier attaches to a check (screenshots, written / email replies, photos,
 * lab reports). It goes into the check's annexure of the report. The working verifier
 * and its Team Leader add or remove proof while the check is open; QA, the case RM and
 * Operations can open it. Every upload, removal and view is audited.
 */
@Injectable()
export class CheckEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
    private readonly inspection: ContentInspectionService,
  ) {}

  private async findCheck(actor: Actor, checkPublicId: string) {
    const check = await this.prisma.caseCheck.findFirst({
      where: {
        publicId: checkPublicId,
        tenantId: actor.tenantId,
        case: caseAccessScope(actor),
      },
      select: {
        id: true,
        publicId: true,
        status: true,
        departmentId: true,
        case: {
          select: { publicId: true, status: true, assignedOpsUserId: true },
        },
        tasks: { select: { assigneeId: true, status: true } },
      },
    });
    if (!check) throw new NotFoundException("Check not found");
    return check;
  }

  private leads(actor: Actor, check: EvidenceCheck) {
    return (actor.departments ?? []).some(
      (d) => d.role === "LEAD" && d.id === check.departmentId,
    );
  }

  /** The verifier working it, its Team Leader or Operations, while the check is open. */
  canEdit(actor: Actor, check: EvidenceCheck) {
    if (check.status === "COMPLETED" || !OPEN_CASE.includes(check.case.status))
      return false;
    if (actor.roles.some((role) => SUPERVISORS.includes(role))) return true;
    if (this.leads(actor, check)) return true;
    return check.tasks.some(
      (task) => task.assigneeId === actor.userId && task.status !== "COMPLETED",
    );
  }

  private canView(actor: Actor, check: EvidenceCheck) {
    if (actor.roles.some((role) => SUPERVISORS.includes(role))) return true;
    if (actor.roles.includes("QA_REVIEWER")) return true;
    if (
      actor.roles.includes("SPOC_RM") &&
      check.case.assignedOpsUserId === actor.userId
    )
      return true;
    return (
      this.leads(actor, check) ||
      check.tasks.some((task) => task.assigneeId === actor.userId)
    );
  }

  private async viewable(actor: Actor, checkPublicId: string) {
    const check = await this.findCheck(actor, checkPublicId);
    if (!this.canView(actor, check))
      throw new NotFoundException("Check not found");
    return check;
  }

  async list(actor: Actor, checkPublicId: string) {
    const check = await this.viewable(actor, checkPublicId);
    const rows = await this.prisma.checkEvidence.findMany({
      where: { checkId: check.id },
      orderBy: { createdAt: "asc" },
      select: {
        publicId: true,
        originalName: true,
        contentType: true,
        sizeBytes: true,
        caption: true,
        createdAt: true,
        uploadedBy: { select: { displayName: true } },
      },
    });
    return {
      checkId: check.publicId,
      canEdit: this.canEdit(actor, check),
      maxFiles: CHECK_EVIDENCE_MAX_FILES,
      maxBytes: CHECK_EVIDENCE_MAX_BYTES,
      items: rows.map((row) => ({
        id: row.publicId,
        name: row.originalName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        caption: row.caption,
        uploadedAt: row.createdAt,
        uploadedBy: row.uploadedBy.displayName,
      })),
    };
  }

  async upload(
    actor: Actor,
    checkPublicId: string,
    file: UploadedBinary,
    caption?: string,
  ) {
    if (!CHECK_EVIDENCE_TYPES.includes(file.mimetype))
      throw new BadRequestException("Upload a PDF, PNG or JPEG file");
    const check = await this.findCheck(actor, checkPublicId);
    if (!this.canEdit(actor, check))
      throw new ForbiddenException(
        "Only the verifier working this check, its Team Leader or Operations can add proof",
      );
    const count = await this.prisma.checkEvidence.count({
      where: { checkId: check.id },
    });
    if (count >= CHECK_EVIDENCE_MAX_FILES)
      throw new ConflictException(
        `At most ${CHECK_EVIDENCE_MAX_FILES} proof files per check`,
      );
    await this.inspection.inspect(file, CHECK_EVIDENCE_MAX_BYTES, {
      documentType: "OTHER",
    });
    const text = caption?.trim().slice(0, 300) || null;
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const objectKey = `${actor.tenantPublicId}/check-evidence/${check.publicId}/${randomUUID()}`;
    await this.storage.put(objectKey, file.buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.checkEvidence.create({
          data: {
            tenantId: actor.tenantId,
            checkId: check.id,
            objectKey,
            originalName: file.originalName.slice(0, 255),
            contentType: file.mimetype,
            sizeBytes: file.size,
            sha256,
            caption: text,
            uploadedById: actor.userId,
          },
          select: { publicId: true, createdAt: true },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "check.evidence-uploaded",
            resourceType: "check",
            resourcePublicId: check.publicId,
            afterJson: JSON.stringify({
              fileId: created.publicId,
              contentType: file.mimetype,
              sizeBytes: file.size,
              sha256,
              caption: text,
            }),
          },
        });
        return {
          id: created.publicId,
          name: file.originalName.slice(0, 255),
          contentType: file.mimetype,
          sizeBytes: file.size,
          caption: text,
          uploadedAt: created.createdAt,
        };
      });
    } catch (error) {
      await this.storage.delete(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async setCaption(
    actor: Actor,
    checkPublicId: string,
    fileId: string,
    caption: string,
  ) {
    const check = await this.findCheck(actor, checkPublicId);
    if (!this.canEdit(actor, check))
      throw new ForbiddenException(
        "Proof can only change while the check is open",
      );
    const text = caption.trim().slice(0, 300) || null;
    const changed = await this.prisma.checkEvidence.updateMany({
      where: { checkId: check.id, publicId: fileId },
      data: { caption: text },
    });
    if (!changed.count) throw new NotFoundException("File not found");
    return { id: fileId, caption: text };
  }

  async remove(actor: Actor, checkPublicId: string, fileId: string) {
    const check = await this.findCheck(actor, checkPublicId);
    if (!this.canEdit(actor, check))
      throw new ForbiddenException(
        "Proof can only change while the check is open",
      );
    return this.prisma.$transaction(async (tx) => {
      const file = await tx.checkEvidence.findFirst({
        where: { checkId: check.id, publicId: fileId },
        select: { id: true, objectKey: true, originalName: true },
      });
      if (!file) throw new NotFoundException("File not found");
      await tx.checkEvidence.delete({ where: { id: file.id } });
      await tx.outboxEvent.create({
        data: {
          tenantId: actor.tenantId,
          topic: "object.delete.requested",
          aggregateType: "check",
          aggregateId: check.publicId,
          payloadJson: JSON.stringify({ objectKey: file.objectKey }),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "check.evidence-removed",
          resourceType: "check",
          resourcePublicId: check.publicId,
          afterJson: JSON.stringify({ fileId, name: file.originalName }),
        },
      });
      return { id: fileId, removed: true };
    });
  }

  async file(actor: Actor, checkPublicId: string, fileId: string) {
    const check = await this.viewable(actor, checkPublicId);
    const file = await this.prisma.checkEvidence.findFirst({
      where: { checkId: check.id, publicId: fileId },
      select: { objectKey: true, contentType: true },
    });
    if (!file) throw new NotFoundException("File not found");
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "check.evidence-viewed",
        resourceType: "check",
        resourcePublicId: check.publicId,
        afterJson: JSON.stringify({ fileId }),
      },
    });
    return new StreamableFile(await this.storage.get(file.objectKey), {
      type: file.contentType,
      disposition: "inline",
    });
  }
}

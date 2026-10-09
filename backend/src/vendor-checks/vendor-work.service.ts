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
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { PrismaService } from "../database/prisma.service";
import { ContentInspectionService } from "../documents/content-inspection.service";
import { DocumentsService } from "../documents/documents.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import type { Prisma } from "../generated/prisma/client";
import {
  cleanVerified,
  verifiedFormFor,
} from "../verification/verified-fields";
import {
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_TYPES,
  VENDOR_CHECK_STATUSES,
  VENDOR_RESULTS,
  exportColumns,
  parseJsonArray,
  parseSubmission,
  vendorText,
} from "./vendor-check-rules";
import {
  boardSummary,
  toVendorRow,
  vendorCsv,
  vendorRowSelect,
} from "./vendor-check-view";
import { vendorLhs } from "./vendor-checks.service";

const WORKING = ["IN_PROGRESS", "RETURNED"];

/** A Main Vendor sees its jobs; a team user only the jobs delegated to it. */
export function ownVendorJobs(
  actor: Actor,
): Prisma.VendorCheckAssignmentWhereInput {
  if (!actor.roles.includes("VENDOR"))
    throw new ForbiddenException("Vendor access is required");
  // A Team Leader's request waiting for the RM (or turned down) never reaches the vendor.
  const sent = { status: { notIn: ["PENDING_APPROVAL", "REJECTED"] } };
  return actor.vendorOwnerId !== undefined
    ? {
        tenantId: actor.tenantId,
        vendorUserId: actor.vendorOwnerId,
        handlerUserId: actor.userId,
        ...sent,
      }
    : { tenantId: actor.tenantId, vendorUserId: actor.userId, ...sent };
}

const isMain = (actor: Actor) => actor.vendorOwnerId === undefined;

/**
 * Vendor workspace for checks (BGV process step 9): accept or decline a job, work it
 * from the check's LHS and the documents shared with it, record the verified details,
 * attach proof and submit. A Main Vendor may hand a job to a team user. Audited.
 */
@Injectable()
export class VendorWorkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
    private readonly inspection: ContentInspectionService,
    private readonly documents: DocumentsService,
  ) {}

  private where(actor: Actor, query: { status?: string; search?: string }) {
    const search = query.search?.trim();
    return {
      ...ownVendorJobs(actor),
      ...(query.status &&
      (VENDOR_CHECK_STATUSES as readonly string[]).includes(query.status)
        ? { status: query.status }
        : {}),
      ...(search
        ? {
            case: {
              OR: [
                { caseNumber: { contains: search } },
                { subject: { fullName: { contains: search } } },
              ],
            },
          }
        : {}),
    } satisfies Prisma.VendorCheckAssignmentWhereInput;
  }

  async list(
    actor: Actor,
    query: { status?: string; search?: string },
    now = new Date(),
  ) {
    const [rows, all] = await Promise.all([
      this.prisma.vendorCheckAssignment.findMany({
        where: this.where(actor, query),
        orderBy: [{ createdAt: "desc" }],
        take: 300,
        select: vendorRowSelect,
      }),
      this.prisma.vendorCheckAssignment.findMany({
        where: ownVendorJobs(actor),
        take: 5000,
        select: vendorRowSelect,
      }),
    ]);
    return {
      summary: boardSummary(all.map((row) => toVendorRow(row, now))),
      items: rows.map((row) => toVendorRow(row, now)),
    };
  }

  async export(
    actor: Actor,
    query: { status?: string; search?: string; columns?: string },
    now = new Date(),
  ) {
    const rows = await this.prisma.vendorCheckAssignment.findMany({
      where: this.where(actor, query),
      orderBy: [{ createdAt: "desc" }],
      take: 5000,
      select: vendorRowSelect,
    });
    const columns = exportColumns(query.columns);
    await this.audit(this.prisma, actor, "board", "vendor_check.exported", {
      rows: rows.length,
      columns,
    });
    return new StreamableFile(
      Buffer.from(
        vendorCsv(
          rows.map((row) => toVendorRow(row, now)),
          columns,
        ),
      ),
      {
        type: "text/csv; charset=utf-8",
        disposition: `attachment; filename="Sapling-Global-my-checks.csv"`,
      },
    );
  }

  private async own(
    actor: Actor,
    jobId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const row = await db.vendorCheckAssignment.findFirst({
      where: { ...ownVendorJobs(actor), publicId: jobId },
      select: {
        ...vendorRowSelect,
        id: true,
        assignedById: true,
        vendorUserId: true,
        handlerUserId: true,
        caseId: true,
        sharedDocumentsJson: true,
        submissionJson: true,
        check: {
          select: { publicId: true, type: true, initiationJson: true },
        },
        evidence: {
          orderBy: { id: "asc" },
          select: {
            publicId: true,
            originalName: true,
            contentType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Check not found");
    return row;
  }

  async detail(actor: Actor, jobId: string) {
    const row = await this.own(actor, jobId);
    const shared = parseJsonArray<string>(row.sharedDocumentsJson);
    const [documents, team] = await Promise.all([
      shared.length
        ? this.prisma.document.findMany({
            where: { caseId: row.caseId, publicId: { in: shared } },
            select: {
              publicId: true,
              type: true,
              versions: {
                where: { malwareState: "CLEAN" },
                orderBy: { version: "desc" },
                take: 1,
                select: { originalName: true, contentType: true },
              },
            },
          })
        : [],
      isMain(actor)
        ? this.prisma.user.findMany({
            where: {
              tenantId: actor.tenantId,
              vendorOwnerId: actor.userId,
              status: "ACTIVE",
            },
            orderBy: { displayName: "asc" },
            select: { publicId: true, displayName: true },
          })
        : [],
    ]);
    return {
      ...toVendorRow(row),
      canDelegate: isMain(actor),
      team: team.map((user) => ({ id: user.publicId, name: user.displayName })),
      lhs: vendorLhs(row.check.type, row.check.initiationJson),
      rhsForm: verifiedFormFor(row.check.type),
      results: VENDOR_RESULTS,
      submission: parseSubmission(row.submissionJson),
      documents: documents.flatMap((document) =>
        document.versions.map((version) => ({
          id: document.publicId,
          type: document.type,
          name: version.originalName,
          contentType: version.contentType,
        })),
      ),
      evidence: row.evidence.map((file) => ({
        id: file.publicId,
        name: file.originalName,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        uploadedAt: file.createdAt,
      })),
    };
  }

  private async move(
    actor: Actor,
    jobId: string,
    from: readonly string[],
    version: number,
    data: Prisma.VendorCheckAssignmentUncheckedUpdateManyInput,
    action: string,
    after: Record<string, unknown>,
    notifyTitle?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.own(actor, jobId, tx);
      if (!from.includes(row.status))
        throw new ConflictException(
          `This check is ${row.status.toLowerCase().replaceAll("_", " ")}`,
        );
      if (row.version !== version)
        throw new ConflictException("Changed meanwhile; refresh and try again");
      const changed = await tx.vendorCheckAssignment.updateMany({
        where: { id: row.id, version },
        data: { ...data, version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException("Changed meanwhile; refresh and try again");
      if (notifyTitle)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: row.assignedById,
            type: "VENDOR_CHECK_UPDATE",
            title: `${notifyTitle}: ${row.case.caseNumber}`,
            body: `${row.vendor.displayName} · ${row.check.type.replaceAll("_", " ").toLowerCase()}`,
            href: "/operations/vendor-work",
          },
        });
      await this.audit(tx, actor, row.publicId, action, {
        caseNumber: row.case.caseNumber,
        checkType: row.check.type,
        ...after,
      });
      return { id: row.publicId, version: version + 1 };
    });
  }

  accept(actor: Actor, jobId: string, version: number) {
    return this.move(
      actor,
      jobId,
      ["ASSIGNED"],
      version,
      { status: "IN_PROGRESS", acceptedAt: new Date() },
      "vendor_check.accepted",
      {},
      "Vendor accepted",
    );
  }

  decline(actor: Actor, jobId: string, version: number, reason: string) {
    const text = vendorText(reason, "Decline reason", 10);
    return this.move(
      actor,
      jobId,
      ["ASSIGNED"],
      version,
      { status: "DECLINED", declineReason: text },
      "vendor_check.declined",
      { reason: text },
      "Vendor declined",
    );
  }

  /** Draft save: entries, result and remarks, without validation. */
  saveDraft(
    actor: Actor,
    jobId: string,
    input: {
      version: number;
      entries: Array<Record<string, unknown>>;
      result?: string;
      remarks?: string;
    },
  ) {
    const entries = input.entries.slice(0, 10).map((entry) =>
      Object.fromEntries(
        Object.entries(entry)
          .filter(([, value]) => typeof value === "string")
          .map(([key, value]) => [
            key.slice(0, 60),
            (value as string).slice(0, 500),
          ]),
      ),
    );
    return this.move(
      actor,
      jobId,
      WORKING,
      input.version,
      {
        submissionJson: JSON.stringify({ entries }),
        result:
          input.result &&
          (VENDOR_RESULTS as readonly string[]).includes(input.result)
            ? input.result
            : null,
        remarks: input.remarks?.trim().slice(0, 2000) || null,
      },
      "vendor_check.draft-saved",
      { entries: entries.length },
    );
  }

  async submit(actor: Actor, jobId: string, version: number) {
    const row = await this.own(actor, jobId);
    const entries = cleanVerified(
      row.check.type,
      parseSubmission(row.submissionJson),
    );
    if (
      !row.result ||
      !(VENDOR_RESULTS as readonly string[]).includes(row.result)
    )
      throw new BadRequestException("Choose the result before submitting");
    vendorText(row.remarks ?? undefined, "Remarks", 10, 2000);
    if (row.result !== "UNABLE_TO_VERIFY" && !row.evidence.length)
      throw new BadRequestException("Attach at least one proof file");
    return this.move(
      actor,
      jobId,
      WORKING,
      version,
      {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submissionJson: JSON.stringify({ entries }),
      },
      "vendor_check.submitted",
      { result: row.result, evidence: row.evidence.length },
      "Vendor result ready to review",
    );
  }

  async delegate(
    actor: Actor,
    jobId: string,
    input: { version: number; userId: string | null },
  ) {
    if (!isMain(actor))
      throw new ForbiddenException("Only the main vendor account can delegate");
    const handler = input.userId
      ? await this.prisma.user.findFirst({
          where: {
            tenantId: actor.tenantId,
            publicId: input.userId,
            vendorOwnerId: actor.userId,
            status: "ACTIVE",
          },
          select: { id: true, publicId: true, displayName: true },
        })
      : null;
    if (input.userId && !handler)
      throw new NotFoundException("Active team user not found");
    const result = await this.move(
      actor,
      jobId,
      ["ASSIGNED", ...WORKING],
      input.version,
      { handlerUserId: handler?.id ?? null },
      "vendor_check.delegated",
      { handler: handler?.publicId ?? null },
    );
    if (handler)
      await this.prisma.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: handler.id,
          type: "VENDOR_CHECK_ASSIGNED",
          title: "A check was handed to you",
          body: "Open My checks to work on it.",
          href: "/vendor/checks",
        },
      });
    return result;
  }

  async uploadEvidence(actor: Actor, jobId: string, file: UploadedBinary) {
    if (!file?.buffer?.length)
      throw new BadRequestException("Choose a file to upload");
    if (!EVIDENCE_TYPES.includes(file.mimetype))
      throw new BadRequestException("Upload a PDF, PNG or JPEG file");
    const row = await this.own(actor, jobId);
    if (!WORKING.includes(row.status))
      throw new ConflictException("Accept the check before adding proof");
    if (row.evidence.length >= EVIDENCE_MAX_FILES)
      throw new ConflictException(`At most ${EVIDENCE_MAX_FILES} proof files`);
    await this.inspection.inspect(file, EVIDENCE_MAX_BYTES, {
      documentType: "OTHER",
    });
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const objectKey = `${actor.tenantPublicId}/vendor-checks/${row.publicId}/${randomUUID()}`;
    await this.storage.put(objectKey, file.buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.vendorCheckEvidence.create({
          data: {
            tenantId: actor.tenantId,
            assignmentId: row.id,
            objectKey,
            originalName: file.originalName.slice(0, 255),
            contentType: file.mimetype,
            sizeBytes: file.size,
            sha256,
            uploadedById: actor.userId,
          },
          select: { publicId: true, createdAt: true },
        });
        await this.audit(
          tx,
          actor,
          row.publicId,
          "vendor_check.proof-uploaded",
          {
            fileId: created.publicId,
            contentType: file.mimetype,
            sizeBytes: file.size,
            sha256,
          },
        );
        return {
          id: created.publicId,
          name: file.originalName.slice(0, 255),
          contentType: file.mimetype,
          sizeBytes: file.size,
          uploadedAt: created.createdAt,
        };
      });
    } catch (error) {
      await this.storage.delete(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async removeEvidence(actor: Actor, jobId: string, fileId: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.own(actor, jobId, tx);
      if (!WORKING.includes(row.status))
        throw new ConflictException(
          "Proof can only change while you work on it",
        );
      const file = await tx.vendorCheckEvidence.findFirst({
        where: { assignmentId: row.id, publicId: fileId },
        select: { id: true, objectKey: true },
      });
      if (!file) throw new NotFoundException("File not found");
      await tx.vendorCheckEvidence.delete({ where: { id: file.id } });
      await tx.outboxEvent.create({
        data: {
          tenantId: actor.tenantId,
          topic: "object.delete.requested",
          aggregateType: "vendor_check",
          aggregateId: row.publicId,
          payloadJson: JSON.stringify({ objectKey: file.objectKey }),
        },
      });
      await this.audit(tx, actor, row.publicId, "vendor_check.proof-removed", {
        fileId,
      });
      return { id: fileId, removed: true };
    });
  }

  /** A document shared with this job (never any other document of the case). */
  async document(actor: Actor, jobId: string, documentId: string) {
    const row = await this.own(actor, jobId);
    if (!parseJsonArray<string>(row.sharedDocumentsJson).includes(documentId))
      throw new NotFoundException("Document not shared with you");
    return (
      await this.documents.download(actor, documentId, "preview", {
        caseScope: { tenantId: actor.tenantId },
      })
    ).file;
  }

  async evidenceFile(actor: Actor, jobId: string, fileId: string) {
    const row = await this.own(actor, jobId);
    const file = await this.prisma.vendorCheckEvidence.findFirst({
      where: { assignmentId: row.id, publicId: fileId },
      select: { objectKey: true, contentType: true },
    });
    if (!file) throw new NotFoundException("File not found");
    return new StreamableFile(await this.storage.get(file.objectKey), {
      type: file.contentType,
      disposition: "inline",
    });
  }

  private audit(
    db: Prisma.TransactionClient | PrismaService,
    actor: Actor,
    jobId: string,
    action: string,
    after: Record<string, unknown>,
  ) {
    return db.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action,
        resourceType: "vendor_check",
        resourcePublicId: jobId,
        afterJson: JSON.stringify(after),
      },
    });
  }
}

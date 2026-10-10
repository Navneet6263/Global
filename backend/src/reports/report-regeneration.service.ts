import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import type { ApprovedReportSnapshot } from "./report-data";
import { ReportPdfService } from "./report-pdf.service";
import { loadProofBytes } from "./report-proofs";

/** An approved report may be rebuilt when it is prepared or already released. */
export const REGENERABLE = ["PREPARED", "PUBLISHED"];

/**
 * Rebuilds an approved report's PDF as a new version, from the same approval snapshot
 * (the findings the RM approved do not change): used when the stored file is missing or
 * the report needs the current layout. The new version gets its own authenticity code;
 * older versions stay on record. The reason is audited.
 */
@Injectable()
export class ReportRegenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
    private readonly pdf: ReportPdfService,
  ) {}

  async regenerate(
    actor: Actor,
    casePublicId: string,
    reportPublicId: string,
    reason: string,
  ) {
    const report = await this.prisma.report.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: reportPublicId,
        case: { ...caseAccessScope(actor), publicId: casePublicId },
      },
      select: {
        id: true,
        publicId: true,
        status: true,
        workflowVersion: true,
        currentVersion: true,
        tenant: { select: { publicId: true } },
        case: { select: { publicId: true, caseNumber: true } },
        managerReview: { select: { decision: true, snapshotJson: true } },
      },
    });
    if (!report) throw new NotFoundException("Report not found");
    if (
      report.workflowVersion !== 2 ||
      report.managerReview?.decision !== "APPROVED" ||
      !REGENERABLE.includes(report.status)
    )
      throw new ConflictException(
        "Only an approved report that is prepared or released can be regenerated",
      );
    const snapshot = JSON.parse(
      report.managerReview.snapshotJson,
    ) as ApprovedReportSnapshot;
    const previous = await this.prisma.reportVersion.aggregate({
      where: { reportId: report.id },
      _max: { version: true },
    });
    const version = (previous._max.version ?? 0) + 1;
    const authenticityCode = `SG-${randomBytes(6).toString("hex").toUpperCase()}`;
    const generatedAt = new Date();
    const contents = await this.pdf.render(
      {
        ...snapshot,
        generatedAt,
        authenticityCode,
        completedAt: snapshot.completedAt
          ? new Date(snapshot.completedAt)
          : null,
      },
      {
        proofs: await loadProofBytes(
          this.prisma,
          this.storage,
          actor.tenantId,
          snapshot,
        ),
      },
    );
    const sha256 = createHash("sha256").update(contents).digest("hex");
    const objectKey = `${report.tenant.publicId}/${report.case.publicId}/reports/${report.publicId}/v${version}-${randomUUID()}.pdf`;
    await this.storage.put(objectKey, contents);
    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.report.updateMany({
          where: { id: report.id, currentVersion: report.currentVersion },
          data: { currentVersion: version },
        });
        if (updated.count !== 1)
          throw new ConflictException(
            "The report changed while regenerating; try again",
          );
        await tx.reportVersion.create({
          data: {
            reportId: report.id,
            version,
            objectKey,
            sha256,
            authenticityCode,
            generatedById: actor.userId,
            generatedAt,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "report.regenerated",
            resourceType: "report",
            resourcePublicId: report.publicId,
            afterJson: JSON.stringify({
              caseNumber: report.case.caseNumber,
              previousVersion: report.currentVersion,
              version,
              sha256,
              authenticityCode,
              reason: reason.trim().slice(0, 500),
            }),
          },
        });
      });
    } catch (error) {
      await this.storage.delete(objectKey).catch(() => undefined);
      throw error;
    }
    return {
      id: report.publicId,
      status: report.status,
      version,
      authenticityCode,
      generatedAt,
    };
  }
}

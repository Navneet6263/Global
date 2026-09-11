import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import type { ApprovedReportSnapshot } from "./report-data";
import { ReportPdfService } from "./report-pdf.service";
import { releasePreparedReport } from "./report-release";

@Injectable()
export class ReportGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
    private readonly pdf: ReportPdfService,
  ) {}

  async generateApproved(
    tenantId: bigint,
    casePublicId: string,
    reportPublicId: string,
  ) {
    const report = await this.prisma.report.findFirst({
      where: {
        tenantId,
        publicId: reportPublicId,
        case: { publicId: casePublicId },
      },
      include: {
        tenant: { select: { publicId: true } },
        case: {
          select: { id: true, publicId: true, status: true, version: true },
        },
        managerReview: {
          select: {
            id: true,
            caseId: true,
            decision: true,
            reviewerId: true,
            snapshotJson: true,
          },
        },
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!report)
      throw new NotFoundException(
        "Requested report does not belong to this case",
      );
    if (
      report.workflowVersion !== 2 ||
      !report.managerReview ||
      report.managerReview.caseId !== report.case.id ||
      report.managerReview.decision !== "APPROVED"
    ) {
      throw new ConflictException(
        "Manager approval is required before generating this report",
      );
    }
    if (
      ["PREPARED", "PUBLISHED"].includes(report.status) &&
      report.versions[0]
    ) {
      const saved = report.versions[0];
      return {
        id: report.publicId,
        status: report.status,
        version: saved.version,
        sha256: saved.sha256,
        authenticityCode: saved.authenticityCode,
        generatedAt: saved.generatedAt,
      };
    }
    if (report.status !== "QUEUED" || report.case.status !== "REPORT_PENDING") {
      throw new ConflictException(
        "Report is not awaiting generation or its approval was superseded",
      );
    }
    const snapshot = JSON.parse(
      report.managerReview.snapshotJson,
    ) as ApprovedReportSnapshot;
    const previous = await this.prisma.reportVersion.aggregate({
      where: { report: { tenantId, caseId: report.case.id } },
      _max: { version: true },
    });
    const version = (previous._max.version ?? 0) + 1;
    const authenticityCode = `SG-${randomBytes(6).toString("hex").toUpperCase()}`;
    const generatedAt = new Date();
    const contents = await this.pdf.render({
      ...snapshot,
      generatedAt,
      authenticityCode,
      completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : null,
    });
    const sha256 = createHash("sha256").update(contents).digest("hex");
    const objectKey = `${report.tenant.publicId}/${casePublicId}/reports/${report.publicId}/v${version}-${randomUUID()}.pdf`;
    await this.storage.put(objectKey, contents);
    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.report.updateMany({
          where: {
            id: report.id,
            currentVersion: report.currentVersion,
            status: "QUEUED",
            managerReviewId: report.managerReviewId,
          },
          data: { currentVersion: version, status: "PREPARED" },
        });
        if (updated.count !== 1)
          throw new ConflictException("Report generation changed concurrently");
        const progressed = await tx.verificationCase.updateMany({
          where: {
            id: report.case.id,
            status: "REPORT_PENDING",
            version: report.case.version,
          },
          data: { status: "PAYMENT_PENDING", version: { increment: 1 } },
        });
        if (progressed.count !== 1)
          throw new ConflictException(
            "Case approval changed during generation",
          );
        await tx.reportVersion.create({
          data: {
            reportId: report.id,
            version,
            objectKey,
            sha256,
            authenticityCode,
            generatedById: report.managerReview!.reviewerId,
            generatedAt,
          },
        });
        await tx.caseStatusHistory.create({
          data: {
            caseId: report.case.id,
            fromStatus: "REPORT_PENDING",
            toStatus: "PAYMENT_PENDING",
            reason:
              "Approved report prepared; awaiting billing and successful payment",
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId,
            action: "report.prepared",
            resourceType: "report",
            resourcePublicId: report.publicId,
            afterJson: JSON.stringify({
              version,
              sha256,
              authenticityCode,
              managerReviewId: report.managerReviewId?.toString(),
              caseId: casePublicId,
            }),
          },
        });
        await releasePreparedReport(tx, tenantId, report.publicId);
      });
    } catch (error) {
      const referenced = await this.prisma.reportVersion.findFirst({
        where: { objectKey },
        select: { id: true },
      });
      if (!referenced) await this.storage.delete(objectKey);
      throw error;
    }
    const result = await this.prisma.report.findUnique({
      where: { id: report.id },
      select: { status: true },
    });
    return {
      id: report.publicId,
      status: result!.status,
      version,
      sha256,
      authenticityCode,
      generatedAt,
    };
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import type { PageQueryDto } from "../common/dto/page-query.dto";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import { ReportGenerationService } from "./report-generation.service";
import { assertManager } from "./manager-review.service";
import { canReadReleasedReport } from "./report-payment-policy";
import { releasePreparedReport } from "./report-release";

const versionSelect = {
  version: true,
  authenticityCode: true,
  sha256: true,
  generatedAt: true,
} as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
    private readonly generation: ReportGenerationService,
  ) {}

  async listPublished(actor: Actor, query: PageQueryDto) {
    const search = query.search?.trim();
    const rows = await this.prisma.report.findMany({
      where: {
        tenantId: actor.tenantId,
        status: "PUBLISHED",
        case: {
          AND: [
            caseAccessScope(actor),
            ...(search
              ? [
                  {
                    OR: [
                      { caseNumber: { contains: search } },
                      { subject: { fullName: { contains: search } } },
                    ],
                  },
                ]
              : []),
          ],
        },
      },
      select: {
        publicId: true,
        status: true,
        currentVersion: true,
        publishedAt: true,
        releasedAt: true,
        downloadExpiresAt: true,
        workflowVersion: true,
        case: {
          select: {
            publicId: true,
            caseNumber: true,
            completedAt: true,
            subject: { select: { fullName: true } },
          },
        },
        versions: {
          select: versionSelect,
          orderBy: { version: "desc" },
          take: 1,
        },
      },
      orderBy: [{ publishedAt: "desc" }, { publicId: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const items = (hasMore ? rows.slice(0, query.limit) : rows).map(
      ({ publicId, case: row, versions, ...report }) => ({
        id: publicId,
        ...report,
        canDownload: canReadReleasedReport(report),
        case: { id: row.publicId, ...row },
        latestVersion: versions[0] ?? null,
      }),
    );
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async listForCase(actor: Actor, casePublicId: string) {
    const rows = await this.prisma.report.findMany({
      where: {
        tenantId: actor.tenantId,
        case: { ...caseAccessScope(actor), publicId: casePublicId },
      },
      select: {
        publicId: true,
        status: true,
        currentVersion: true,
        publishedAt: true,
        createdAt: true,
        releasedAt: true,
        downloadExpiresAt: true,
        workflowVersion: true,
        versions: { select: versionSelect, orderBy: { version: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      items: rows.map(({ publicId, ...report }) => ({
        id: publicId,
        ...report,
        canDownload: canReadReleasedReport(report),
      })),
    };
  }

  async generate(actor: Actor, casePublicId: string) {
    assertManager(actor);
    const report = await this.prisma.report.findFirst({
      where: {
        tenantId: actor.tenantId,
        workflowVersion: 2,
        case: { ...caseAccessScope(actor), publicId: casePublicId },
        status: { in: ["QUEUED", "PREPARED", "PUBLISHED"] },
      },
      orderBy: { createdAt: "desc" },
      select: { publicId: true },
    });
    if (!report)
      throw new ConflictException(
        "Approve the case as an independent manager before requesting its report",
      );
    return this.generation.generateApproved(
      actor.tenantId,
      casePublicId,
      report.publicId,
    );
  }

  // Internal worker entry: persisted approval authorizes this exact tenant/case/report.
  generateRequested(
    tenantId: bigint,
    casePublicId: string,
    reportPublicId: string,
  ) {
    return this.generation.generateApproved(
      tenantId,
      casePublicId,
      reportPublicId,
    );
  }

  async release(actor: Actor, casePublicId: string, reportPublicId: string) {
    assertManager(actor);
    const report = await this.prisma.report.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: reportPublicId,
        case: { ...caseAccessScope(actor), publicId: casePublicId },
      },
      select: { id: true },
    });
    if (!report) throw new NotFoundException("Report not found");
    const released = await this.prisma.$transaction(
      (tx) =>
        releasePreparedReport(tx, actor.tenantId, reportPublicId, actor.userId),
      { isolationLevel: "Serializable" },
    );
    if (!released)
      throw new ConflictException(
        "Report requires preparation, valid reviewed evidence and successful full payment of its linked invoices",
      );
    return { id: reportPublicId, status: "PUBLISHED" };
  }

  async download(actor: Actor, reportPublicId: string) {
    const report = await this.prisma.report.findFirst({
      where: {
        publicId: reportPublicId,
        tenantId: actor.tenantId,
        case: caseAccessScope(actor),
      },
      select: {
        status: true,
        releasedAt: true,
        workflowVersion: true,
        downloadExpiresAt: true,
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { objectKey: true, version: true },
        },
      },
    });
    if (!report || !canReadReleasedReport(report) || !report.versions[0]) {
      throw new NotFoundException(
        "Released report is unavailable or its download access has expired",
      );
    }
    const version = report.versions[0];
    const stream = await this.storage.auditedStream(version.objectKey, () =>
      this.prisma.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "report.downloaded",
          resourceType: "report",
          resourcePublicId: reportPublicId,
          afterJson: JSON.stringify({ version: version.version }),
        },
      }),
    );
    return new StreamableFile(stream, {
      type: "application/pdf",
      disposition: `attachment; filename="Sapling-Global-report-v${version.version}.pdf"`,
    });
  }

  async verify(authenticityCode: string) {
    const version = await this.prisma.reportVersion.findUnique({
      where: { authenticityCode },
      select: {
        version: true,
        sha256: true,
        generatedAt: true,
        report: {
          select: {
            status: true,
            currentVersion: true,
            releasedAt: true,
            workflowVersion: true,
            case: { select: { caseNumber: true, completedAt: true } },
          },
        },
      },
    });
    if (!version)
      throw new NotFoundException("Report authenticity code not found");
    return {
      valid:
        version.report.status === "PUBLISHED" &&
        version.version === version.report.currentVersion &&
        (version.report.workflowVersion === 1 ||
          Boolean(version.report.releasedAt)),
      caseNumber: version.report.case.caseNumber,
      reportVersion: version.version,
      sha256: version.sha256,
      generatedAt: version.generatedAt,
      completedAt: version.report.case.completedAt,
    };
  }
}

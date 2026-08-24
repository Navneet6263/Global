import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import { ReportPdfService } from "./report-pdf.service";

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
    private readonly pdf: ReportPdfService,
  ) {}

  async listForCase(actor: Actor, casePublicId: string) {
    const reports = await this.prisma.report.findMany({
      where: {
        tenantId: actor.tenantId,
        case: {
          publicId: casePublicId,
          ...(actor.clientId ? { clientId: actor.clientId } : {}),
        },
      },
      select: {
        publicId: true,
        status: true,
        currentVersion: true,
        publishedAt: true,
        createdAt: true,
        versions: {
          select: {
            version: true,
            sha256: true,
            authenticityCode: true,
            generatedAt: true,
          },
          orderBy: { version: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      items: reports.map(({ publicId, ...report }) => ({
        id: publicId,
        ...report,
      })),
    };
  }

  async generate(actor: Actor, casePublicId: string) {
    const verificationCase = await this.prisma.verificationCase.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: casePublicId,
        status: { in: ["COMPLETED", "CLOSED"] },
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
      },
      include: {
        tenant: { select: { publicId: true } },
        client: { select: { displayName: true } },
        subject: { select: { fullName: true } },
        checks: {
          include: {
            findings: {
              select: { severity: true, title: true, description: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        reports: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!verificationCase)
      throw new NotFoundException("Completed case not found");

    const existing = verificationCase.reports[0];
    const report =
      existing ??
      (await this.prisma.report.create({
        data: { tenantId: actor.tenantId, caseId: verificationCase.id },
      }));
    const version = report.currentVersion + 1;
    const authenticityCode = `SG-${randomBytes(6).toString("hex").toUpperCase()}`;
    const generatedAt = new Date();
    const contents = await this.pdf.render({
      caseNumber: verificationCase.caseNumber,
      generatedAt,
      authenticityCode,
      clientName: verificationCase.client.displayName,
      candidateName: verificationCase.subject.fullName,
      completedAt: verificationCase.completedAt,
      riskLevel: verificationCase.riskLevel,
      checks: verificationCase.checks.map((check) => ({
        type: check.type,
        result: check.result,
        riskLevel: check.riskLevel,
        sourceSummary: check.sourceSummary,
        findings: check.findings,
      })),
    });
    const sha256 = createHash("sha256").update(contents).digest("hex");
    const objectKey = `${verificationCase.tenant.publicId}/${casePublicId}/reports/${report.publicId}/v${version}-${randomUUID()}.pdf`;
    await this.storage.put(objectKey, contents);

    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.report.updateMany({
          where: { id: report.id, currentVersion: report.currentVersion },
          data: {
            currentVersion: version,
            status: "PUBLISHED",
            publishedAt: generatedAt,
          },
        });
        if (updated.count !== 1)
          throw new ConflictException(
            "A report version was generated concurrently",
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
            action: "report.generated",
            resourceType: "report",
            resourcePublicId: report.publicId,
            afterJson: JSON.stringify({ version, sha256, authenticityCode }),
          },
        });
      });
    } catch (error) {
      await this.deleteIfUnreferenced(objectKey);
      throw error;
    }
    return {
      id: report.publicId,
      status: "PUBLISHED",
      version,
      sha256,
      authenticityCode,
      generatedAt,
    };
  }

  async download(actor: Actor, reportPublicId: string) {
    const version = await this.prisma.reportVersion.findFirst({
      where: {
        report: {
          publicId: reportPublicId,
          tenantId: actor.tenantId,
          status: "PUBLISHED",
          ...(actor.clientId ? { case: { clientId: actor.clientId } } : {}),
        },
      },
      orderBy: { version: "desc" },
      select: { objectKey: true, version: true },
    });
    if (!version) throw new NotFoundException("Published report not found");
    const contents = await this.storage.get(version.objectKey);
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "report.downloaded",
        resourceType: "report",
        resourcePublicId: reportPublicId,
        afterJson: JSON.stringify({ version: version.version }),
      },
    });
    return new StreamableFile(contents, {
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
            case: { select: { caseNumber: true, completedAt: true } },
          },
        },
      },
    });
    if (!version)
      throw new NotFoundException("Report authenticity code not found");
    return {
      valid: version.report.status === "PUBLISHED",
      caseNumber: version.report.case.caseNumber,
      reportVersion: version.version,
      sha256: version.sha256,
      generatedAt: version.generatedAt,
      completedAt: version.report.case.completedAt,
    };
  }

  private async deleteIfUnreferenced(objectKey: string): Promise<void> {
    try {
      const referenced = await this.prisma.reportVersion.findFirst({
        where: { objectKey },
        select: { id: true },
      });
      if (!referenced) await this.storage.delete(objectKey);
    } catch (error) {
      this.logger.warn(
        `Deferred unreferenced report cleanup: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}

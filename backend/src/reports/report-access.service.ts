import {
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import { assertManager } from "./manager-review.service";
import { reportDownloadExpiry } from "./report-access-policy";

@Injectable()
export class ReportAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
  ) {}

  async preview(actor: Actor, publicId: string) {
    assertManager(actor);
    const report = await this.prisma.report.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        case: caseAccessScope(actor),
        status: { in: ["PREPARED", "PUBLISHED", "SUPERSEDED"] },
      },
      select: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { objectKey: true, version: true },
        },
      },
    });
    const version = report?.versions[0];
    if (!version) throw new NotFoundException("Prepared report is unavailable");
    const stream = await this.storage.auditedStream(version.objectKey, () =>
      this.prisma.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "report.internal-preview",
          resourceType: "report",
          resourcePublicId: publicId,
          afterJson: JSON.stringify({ version: version.version }),
        },
      }),
    );
    return new StreamableFile(stream, {
      type: "application/pdf",
      disposition: `inline; filename="Sapling-review-v${version.version}.pdf"`,
    });
  }

  async renew(actor: Actor, publicId: string) {
    assertManager(actor);
    const report = await this.prisma.report.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        workflowVersion: 2,
        status: "PUBLISHED",
        releasedAt: { not: null },
        case: caseAccessScope(actor),
      },
      select: { id: true, currentVersion: true },
    });
    if (!report) throw new NotFoundException("Released report not found");
    const expiresAt = reportDownloadExpiry();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.updateMany({
        where: {
          id: report.id,
          status: "PUBLISHED",
          currentVersion: report.currentVersion,
        },
        data: { downloadExpiresAt: expiresAt },
      });
      if (updated.count !== 1)
        throw new ConflictException("Report changed during access renewal");
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "report.download-access-renewed",
          resourceType: "report",
          resourcePublicId: publicId,
          afterJson: JSON.stringify({
            expiresAt,
            reportVersion: report.currentVersion,
          }),
        },
      });
    });
    return { id: publicId, downloadExpiresAt: expiresAt };
  }
}

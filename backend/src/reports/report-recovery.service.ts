import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { activeOperationsRecipients } from "../common/persistence/operations-recipients";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class ReportRecoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async markFailed(tenantId: bigint, reportPublicId: string, error: unknown) {
    const report = await this.prisma.report.findFirst({
      where: { tenantId, publicId: reportPublicId },
      select: {
        id: true,
        status: true,
        case: {
          select: {
            publicId: true,
            caseNumber: true,
            branchId: true,
            clientId: true,
            assignedOpsUserId: true,
          },
        },
      },
    });
    if (!report || report.status === "PUBLISHED") return;
    const detail = (error instanceof Error ? error.message : "Unknown error").slice(0, 500);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.updateMany({
        where: { id: report.id, status: { not: "PUBLISHED" } },
        data: { status: "FAILED" },
      });
      if (updated.count !== 1) return;
      const recipients = await activeOperationsRecipients(tx, {
        tenantId,
        branchId: report.case.branchId,
        clientId: report.case.clientId,
        assignedUserId: report.case.assignedOpsUserId,
      });
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            tenantId,
            userId: recipient.id,
            type: "REPORT_GENERATION_FAILED",
            title: "Report generation needs attention",
            body: `${report.case.caseNumber}: report generation failed after retries.`,
            href: `/cases/${report.case.publicId}`,
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId,
          action: "report.generation-failed",
          resourceType: "report",
          resourcePublicId: reportPublicId,
          afterJson: JSON.stringify({ status: "FAILED", detail }),
        },
      });
    });
  }

  async retry(actor: Actor, casePublicId: string, reportPublicId: string) {
    const report = await this.prisma.report.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: reportPublicId,
        status: "FAILED",
        case: {
          ...caseAccessScope(actor),
          publicId: casePublicId,
          status: { in: ["COMPLETED", "CLOSED"] },
        },
      },
      select: { id: true },
    });
    if (!report) throw new NotFoundException("Failed report not found");
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.updateMany({
        where: { id: report.id, status: "FAILED" },
        data: { status: "QUEUED" },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Report retry was already requested");
      }
      await tx.outboxEvent.create({
        data: {
          tenantId: actor.tenantId,
          topic: "report.generate.requested",
          aggregateType: "report",
          aggregateId: reportPublicId,
          payloadJson: JSON.stringify({
            reportId: reportPublicId,
            caseId: casePublicId,
            actorUserId: actor.userPublicId,
          }),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "report.generation-retried",
          resourceType: "report",
          resourcePublicId: reportPublicId,
        },
      });
    });
    return { id: reportPublicId, status: "QUEUED" };
  }
}

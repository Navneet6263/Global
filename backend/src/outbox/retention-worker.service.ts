import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class RetentionWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RetentionWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.get<boolean>("RETENTION_WORKER_ENABLED", true)) {
      this.logger.log("Retention worker is disabled for this process");
      return;
    }
    const interval = this.config.get<number>(
      "RETENTION_POLL_INTERVAL_MS",
      86_400_000,
    );
    this.timer = setInterval(() => void this.run(), interval);
    this.timer.unref();
    void this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      const policies = await this.prisma.tenantFieldPolicy.findMany({
        select: { tenantId: true, retentionDays: true },
      });
      for (const policy of policies) {
        const cutoff = new Date(Date.now() - policy.retentionDays * 86_400_000);
        const visits = await this.prisma.fieldVisit.findMany({
          where: {
            tenantId: policy.tenantId,
            completedAt: { lt: cutoff },
            capturedAt: { not: null },
          },
          select: {
            id: true,
            publicId: true,
            evidence: { select: { objectKey: true } },
          },
          orderBy: { completedAt: "asc" },
          take: 100,
        });
        for (const visit of visits) {
          try {
            await this.prisma.$transaction(async (tx) => {
              await tx.evidenceItem.deleteMany({
                where: { fieldVisitId: visit.id },
              });
              await tx.fieldVisit.update({
                where: { id: visit.id },
                data: {
                  capturedLatitude: null,
                  capturedLongitude: null,
                  accuracyMeters: null,
                  distanceMeters: null,
                  capturedAt: null,
                  checklistJson: null,
                  remarks: null,
                },
              });
              await tx.auditEvent.create({
                data: {
                  tenantId: policy.tenantId,
                  action: "field_visit.retention-applied",
                  resourceType: "field_visit",
                  resourcePublicId: visit.publicId,
                  afterJson: JSON.stringify({
                    evidenceDeleted: visit.evidence.length,
                    retentionDays: policy.retentionDays,
                  }),
                },
              });
              if (visit.evidence.length) {
                await tx.outboxEvent.createMany({
                  data: visit.evidence.map((evidence) => ({
                    tenantId: policy.tenantId,
                    topic: "object.delete.requested",
                    aggregateType: "field_visit",
                    aggregateId: visit.publicId,
                    payloadJson: JSON.stringify({
                      objectKey: evidence.objectKey,
                    }),
                  })),
                });
              }
            });
          } catch (error) {
            this.logger.error(
              `Retention failed for field visit ${visit.publicId}: ${
                error instanceof Error ? error.message : "unknown error"
              }`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Retention polling failed",
      );
    } finally {
      this.running = false;
    }
  }
}

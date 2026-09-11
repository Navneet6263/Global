import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { RuntimeHealthService } from "../health/runtime-health.service";

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
    private readonly health: RuntimeHealthService,
  ) {}

  onApplicationBootstrap() {
    const processRole = this.config.get<string>("PROCESS_ROLE", "all");
    if (!["all", "worker"].includes(processRole)) {
      this.logger.log(`Retention worker skipped for ${processRole} process`);
      return;
    }
    if (!this.config.get<boolean>("RETENTION_WORKER_ENABLED", true)) {
      this.logger.log("Retention worker is disabled for this process");
      return;
    }
    const interval = this.config.get<number>(
      "RETENTION_POLL_INTERVAL_MS",
      86_400_000,
    );
    this.health.register("retention", interval * 2 + 60_000);
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
            case: { retentionHoldAt: null },
            completedAt: { lt: cutoff },
            capturedAt: { not: null },
          },
          select: {
            id: true,
            publicId: true,
            caseId: true,
            evidence: { select: { objectKey: true } },
          },
          orderBy: { completedAt: "asc" },
          take: 100,
        });
        for (const visit of visits) {
          try {
            await this.prisma.$transaction(async (tx) => {
              // Serialize with privacy holds before scheduling any irreversible deletion.
              const unheld = await tx.verificationCase.updateMany({
                where: {
                  id: visit.caseId,
                  tenantId: policy.tenantId,
                  retentionHoldAt: null,
                },
                data: { version: { increment: 1 } },
              });
              if (!unheld.count) return;
              const claimed = await tx.fieldVisit.updateMany({
                where: {
                  id: visit.id,
                  completedAt: { lt: cutoff },
                  capturedAt: { not: null },
                },
                data: {
                  capturedLatitude: null,
                  capturedLongitude: null,
                  accuracyMeters: null,
                  distanceMeters: null,
                  capturedAt: null,
                  checkInLatitude: null,
                  checkInLongitude: null,
                  checkInAccuracy: null,
                  checkedInAt: null,
                  checklistJson: null,
                  remarks: null,
                },
              });
              if (claimed.count !== 1) return;
              await tx.evidenceItem.deleteMany({
                where: { fieldVisitId: visit.id },
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
      this.health.success("retention");
    } catch (error) {
      this.health.failure("retention", error);
      this.logger.error(
        error instanceof Error ? error.message : "Retention polling failed",
      );
    } finally {
      this.running = false;
    }
  }
}

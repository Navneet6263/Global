import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class DataHousekeepingService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(DataHousekeepingService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.run(), 86_400_000);
    this.timer.unref();
    void this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    if (this.running) return 0;
    this.running = true;
    try {
      const now = new Date();
      const terminalCutoff = new Date(now.getTime() - 30 * 86_400_000);
      const [sessions, links, outbox] = await Promise.all([
        this.prisma.refreshSession.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { revokedAt: { lt: terminalCutoff } },
            ],
          },
        }),
        this.prisma.candidatePortalAccess.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { revokedAt: { lt: terminalCutoff } },
            ],
          },
        }),
        this.prisma.outboxEvent.deleteMany({
          where: {
            OR: [
              { status: "PROCESSED" },
              {
                status: "FAILED",
                topic: { not: "object.delete.requested" },
              },
            ],
            createdAt: { lt: terminalCutoff },
          },
        }),
      ]);
      return sessions.count + links.count + outbox.count;
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Data housekeeping failed",
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}

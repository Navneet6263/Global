import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class IdempotencyCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(IdempotencyCleanupService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    const interval = this.config.get<number>(
      "IDEMPOTENCY_CLEANUP_INTERVAL_MS",
      3_600_000,
    );
    this.timer = setInterval(() => void this.run(), interval);
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
      const result = await this.prisma.idempotencyKey.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return result.count;
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Idempotency cleanup failed",
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}

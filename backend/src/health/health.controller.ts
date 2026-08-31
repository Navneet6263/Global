import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../common/auth/auth.decorators";
import { PrismaService } from "../database/prisma.service";
import { ConfigService } from "@nestjs/config";
import { RuntimeHealthService } from "./runtime-health.service";
import { DependencyHealthService } from "./dependency-health.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly runtime: RuntimeHealthService,
    private readonly dependencies: DependencyHealthService,
  ) {}

  @Get("live")
  @Public()
  live() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  @Public()
  async ready() {
    try {
      await this.prisma.$queryRawUnsafe("SELECT 1 AS ok");
    } catch {
      throw new ServiceUnavailableException("Database is unavailable");
    }

    const processRole = this.config.get<string>("PROCESS_ROLE", "all");
    const workerState = this.runtime.snapshot(
      processRole === "all" || processRole === "worker",
    );
    if (!workerState.healthy) {
      throw new ServiceUnavailableException("Background workers are unhealthy");
    }

    let dependencies: Awaited<ReturnType<DependencyHealthService["probe"]>>;
    try {
      dependencies = await this.dependencies.probe();
    } catch {
      throw new ServiceUnavailableException(
        "A required platform dependency is unavailable",
      );
    }

    return {
      status: "ready",
      database: "up",
      processRole,
      ...workerState,
      dependencies,
      timestamp: new Date().toISOString(),
    };
  }
}

import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../common/auth/auth.decorators";
import { PrismaService } from "../database/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
      return {
        status: "ready",
        database: "up",
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException("Database is unavailable");
    }
  }
}

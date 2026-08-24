import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../generated/prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const adapter = new PrismaMssql({
      server: config.getOrThrow<string>("DB_HOST"),
      port: config.get<number>("DB_PORT", 1433),
      database: config.getOrThrow<string>("DB_NAME"),
      user: config.getOrThrow<string>("DB_USER"),
      password: config.getOrThrow<string>("DB_PASSWORD"),
      connectionTimeout: config.get<number>("DB_CONNECTION_TIMEOUT_MS", 30_000),
      requestTimeout: config.get<number>("DB_REQUEST_TIMEOUT_MS", 30_000),
      pool: {
        max: config.get<number>("DB_POOL_MAX", 20),
        min: config.get<number>("DB_POOL_MIN", 2),
        idleTimeoutMillis: 60_000,
      },
      options: {
        encrypt: config.get<boolean>("DB_ENCRYPT", true),
        trustServerCertificate: config.get<boolean>(
          "DB_TRUST_SERVER_CERTIFICATE",
          false,
        ),
      },
    });
    super({
      adapter,
      transactionOptions: {
        maxWait: config.get<number>("DB_TRANSACTION_MAX_WAIT_MS", 10_000),
        timeout: config.get<number>("DB_TRANSACTION_TIMEOUT_MS", 30_000),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async withTransientReadRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isTransientConnectionError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
      return operation();
    }
  }

  private isTransientConnectionError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const code = "code" in error ? String(error.code) : "";
    if (
      [
        "ETIMEOUT",
        "ESOCKET",
        "ECONNCLOSED",
        "P1001",
        "P1002",
        "P2024",
      ].includes(code)
    ) {
      return true;
    }
    const message = error instanceof Error ? error.message : "";
    return /failed to connect|connection.*(?:closed|timeout)|pool.*timeout/i.test(
      message,
    );
  }
}

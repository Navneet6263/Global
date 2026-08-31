import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";

type ClaimIdentity = { id: bigint; claimToken: string };

@Injectable()
export class OutboxClaimService {
  constructor(private readonly prisma: PrismaService) {}

  async claim() {
    const candidate = await this.prisma.outboxEvent.findFirst({
      where: {
        status: { in: ["PENDING", "RETRY"] },
        availableAt: { lte: new Date() },
      },
      orderBy: [{ availableAt: "asc" }, { id: "asc" }],
    });
    if (!candidate) return null;
    const claimedAt = new Date();
    const claimToken = randomUUID();
    const claimed = await this.prisma.outboxEvent.updateMany({
      where: { id: candidate.id, status: candidate.status },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        claimedAt,
        claimToken,
      },
    });
    return claimed.count === 1
      ? {
          ...candidate,
          attempts: candidate.attempts + 1,
          claimedAt,
          claimToken,
        }
      : null;
  }

  async complete(event: ClaimIdentity, redactPayload = false) {
    const completed = await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: "PROCESSING",
        claimToken: event.claimToken,
      },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        claimedAt: null,
        claimToken: null,
        ...(redactPayload ? { payloadJson: "{}" } : {}),
      },
    });
    return completed.count === 1;
  }

  async fail(
    event: ClaimIdentity,
    terminal: boolean,
    availableAt: Date,
    redactPayload = false,
  ) {
    await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: "PROCESSING",
        claimToken: event.claimToken,
      },
      data: {
        status: terminal ? "FAILED" : "RETRY",
        availableAt,
        claimedAt: null,
        claimToken: null,
        ...(terminal && redactPayload ? { payloadJson: "{}" } : {}),
      },
    });
  }

  async recoverAbandoned() {
    const cutoff = new Date(Date.now() - 15 * 60_000);
    const recovered = await this.prisma.outboxEvent.updateMany({
      where: {
        status: "PROCESSING",
        OR: [
          { claimedAt: { lt: cutoff } },
          { claimedAt: null, availableAt: { lt: cutoff } },
        ],
      },
      data: {
        status: "RETRY",
        availableAt: new Date(),
        claimedAt: null,
        claimToken: null,
      },
    });
    return recovered.count;
  }
}

export type ClaimedOutboxEvent = NonNullable<
  Awaited<ReturnType<OutboxClaimService["claim"]>>
>;

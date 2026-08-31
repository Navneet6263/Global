import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { ClaimedOutboxEvent } from "./outbox-claim.service";

const OBJECT_DELETE_TOPIC = "object.delete.requested";

type FailedDeletionQuery = { page: number; pageSize: number };

@Injectable()
export class ObjectDeletionRecoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async failTerminal(event: ClaimedOutboxEvent, error: unknown) {
    const failedAt = new Date();
    const detail = (error instanceof Error ? error.message : "Unknown error").slice(0, 500);
    return this.prisma.$transaction(async (tx) => {
      const failed = await tx.outboxEvent.updateMany({
        where: {
          id: event.id,
          status: "PROCESSING",
          claimToken: event.claimToken,
          topic: OBJECT_DELETE_TOPIC,
        },
        data: {
          status: "FAILED",
          processedAt: failedAt,
          claimedAt: null,
          claimToken: null,
        },
      });
      if (failed.count !== 1) return false;

      const recipients = await tx.user.findMany({
        where: {
          tenantId: event.tenantId,
          status: "ACTIVE",
          userRoles: { some: { role: { code: "PLATFORM_ADMIN" } } },
        },
        select: { id: true },
      });
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map(({ id }) => ({
            tenantId: event.tenantId,
            userId: id,
            type: "OBJECT_DELETION_FAILED",
            title: "Stored evidence deletion needs attention",
            body: `Deletion job ${event.id.toString()} failed after ${event.attempts} attempts.`,
            href: `/admin/audit?search=${event.id.toString()}`,
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: event.tenantId,
          action: "object.deletion-failed",
          resourceType: "outbox_event",
          resourcePublicId: event.id.toString(),
          afterJson: JSON.stringify({
            status: "FAILED",
            topic: event.topic,
            attempts: event.attempts,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            payloadPreserved: true,
            detail,
          }),
        },
      });
      return true;
    });
  }

  async listFailed(actor: Actor, query: FailedDeletionQuery) {
    const where = {
      tenantId: actor.tenantId,
      topic: OBJECT_DELETE_TOPIC,
      status: "FAILED",
    };
    const [rows, total] = await Promise.all([
      this.prisma.outboxEvent.findMany({
        where,
        select: {
          id: true,
          aggregateType: true,
          aggregateId: true,
          payloadJson: true,
          attempts: true,
          processedAt: true,
          createdAt: true,
        },
        orderBy: [{ processedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.outboxEvent.count({ where }),
    ]);
    return {
      items: rows.map(({ payloadJson, id, ...row }) => {
        const objectKey = this.objectKey(payloadJson);
        return {
          id: id.toString(),
          ...row,
          objectKey,
          recoverable: Boolean(objectKey),
        };
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async requeue(actor: Actor, eventId: string) {
    const id = this.eventId(eventId);
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.outboxEvent.findFirst({
        where: {
          id,
          tenantId: actor.tenantId,
          topic: OBJECT_DELETE_TOPIC,
          status: "FAILED",
        },
        select: {
          id: true,
          payloadJson: true,
          attempts: true,
          aggregateType: true,
          aggregateId: true,
        },
      });
      if (!event) throw new NotFoundException("Failed object deletion not found");
      if (!this.objectKey(event.payloadJson)) {
        throw new ConflictException("Deletion payload is missing its durable object key");
      }
      const requeued = await tx.outboxEvent.updateMany({
        where: {
          id: event.id,
          tenantId: actor.tenantId,
          topic: OBJECT_DELETE_TOPIC,
          status: "FAILED",
        },
        data: {
          status: "RETRY",
          attempts: 0,
          availableAt: new Date(),
          claimedAt: null,
          claimToken: null,
          processedAt: null,
        },
      });
      if (requeued.count !== 1) {
        throw new ConflictException("Object deletion was already requeued");
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "object.deletion-requeued",
          resourceType: "outbox_event",
          resourcePublicId: event.id.toString(),
          beforeJson: JSON.stringify({ status: "FAILED", attempts: event.attempts }),
          afterJson: JSON.stringify({
            status: "RETRY",
            attempts: 0,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            payloadPreserved: true,
          }),
        },
      });
      return { id: event.id.toString(), status: "RETRY" as const };
    });
  }

  private eventId(value: string) {
    if (!/^[1-9]\d*$/.test(value)) throw new BadRequestException("Invalid outbox event ID");
    return BigInt(value);
  }

  private objectKey(payloadJson: string) {
    try {
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      return typeof payload.objectKey === "string" && payload.objectKey.length
        ? payload.objectKey
        : null;
    } catch {
      return null;
    }
  }
}

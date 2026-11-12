import type { Logger } from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { LocalObjectStorageService } from "./local-object-storage.service";

const UPLOAD_CLEANUP_LEASE_MS = 15 * 60_000;

export async function cancelUploadLease(
  tx: Pick<Prisma.TransactionClient, "outboxEvent">,
  leaseId: bigint | undefined,
): Promise<void> {
  if (!leaseId || typeof tx.outboxEvent?.updateMany !== "function") return;
  await tx.outboxEvent.updateMany({
    where: { id: leaseId, status: "PENDING" },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      payloadJson: "{}",
    },
  });
}

export async function withUploadStorageLease<T>(
  input: {
    prisma: PrismaService;
    storage: LocalObjectStorageService;
    logger: Logger;
    tenantId: bigint;
    aggregateId: string;
    objectKey: string;
    buffer: Buffer;
  },
  commit: (leaseId: bigint | undefined) => Promise<T>,
): Promise<T> {
  const { prisma, storage, logger, tenantId, aggregateId, objectKey, buffer } =
    input;
  const lease =
    typeof prisma.outboxEvent?.create === "function"
      ? await prisma.outboxEvent.create({
          data: {
            tenantId,
            topic: "object.delete.requested",
            aggregateType: "document_upload_lease",
            aggregateId,
            availableAt: new Date(Date.now() + UPLOAD_CLEANUP_LEASE_MS),
            payloadJson: JSON.stringify({
              objectKey,
              reason: "abandoned-upload-lease",
            }),
          },
          select: { id: true },
        })
      : undefined;

  try {
    await storage.put(objectKey, buffer);
  } catch (error) {
    await cancelUploadLeaseSafely(prisma, lease?.id, logger);
    throw error;
  }

  try {
    return await commit(lease?.id);
  } catch (error) {
    await recoverFailedUpload({
      prisma,
      storage,
      logger,
      objectKey,
      leaseId: lease?.id,
    });
    throw error;
  }
}

async function cancelUploadLeaseSafely(
  prisma: PrismaService,
  leaseId: bigint | undefined,
  logger: Logger,
): Promise<void> {
  try {
    await cancelUploadLease(prisma, leaseId);
  } catch (error) {
    logger.warn(
      `Failed to cancel pre-write upload lease: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

async function recoverFailedUpload(input: {
  prisma: PrismaService;
  storage: LocalObjectStorageService;
  logger: Logger;
  objectKey: string;
  leaseId: bigint | undefined;
}): Promise<void> {
  const { prisma, storage, logger, objectKey, leaseId } = input;
  try {
    const referenced =
      typeof prisma.documentVersion?.findFirst === "function"
        ? await prisma.documentVersion.findFirst({
            where: { objectKey },
            select: { id: true },
          })
        : null;
    if (referenced) {
      await cancelUploadLeaseSafely(prisma, leaseId, logger);
      return;
    }
    await storage.delete(objectKey);
    await cancelUploadLeaseSafely(prisma, leaseId, logger);
  } catch (cleanupError) {
    logger.warn(
      `Deferred unreferenced document cleanup: ${cleanupError instanceof Error ? cleanupError.message : "unknown error"}`,
    );
    if (leaseId && typeof prisma.outboxEvent?.updateMany === "function") {
      try {
        await prisma.outboxEvent.updateMany({
          where: { id: leaseId, status: "PENDING" },
          data: { availableAt: new Date() },
        });
      } catch (expediteError) {
        logger.warn(
          `Failed to expedite upload cleanup lease: ${expediteError instanceof Error ? expediteError.message : "unknown error"}`,
        );
      }
    }
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { taskAccessScope } from "./task-query.helpers";

@Injectable()
export class TaskContextService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor, taskPublicId: string) {
    const task = await this.prisma.checkTask.findFirst({
      where: { ...taskAccessScope(actor), publicId: taskPublicId },
      select: {
        publicId: true,
        createdAt: true,
        startedAt: true,
        blockedAt: true,
        completedAt: true,
        check: {
          select: {
            publicId: true,
            type: true,
            case: {
              select: {
                publicId: true,
                caseNumber: true,
                status: true,
                priority: true,
                dueAt: true,
                subject: {
                  select: {
                    publicId: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    employeeCode: true,
                  },
                },
                client: { select: { publicId: true, displayName: true } },
                branch: { select: { publicId: true, name: true, city: true } },
                servicePackage: { select: { publicId: true, name: true } },
                consents: {
                  select: {
                    publicId: true,
                    status: true,
                    acceptedAt: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: "desc" },
                },
                documents: {
                  select: {
                    publicId: true,
                    type: true,
                    status: true,
                    currentVersion: true,
                    versions: {
                      select: {
                        version: true,
                        originalName: true,
                        contentType: true,
                        sizeBytes: true,
                        sha256: true,
                        malwareState: true,
                        createdAt: true,
                      },
                      orderBy: { version: "desc" },
                      take: 1,
                    },
                  },
                  orderBy: { updatedAt: "desc" },
                },
                clarifications: {
                  select: {
                    publicId: true,
                    status: true,
                    subject: true,
                    dueAt: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: "desc" },
                },
                statusHistory: {
                  select: {
                    fromStatus: true,
                    toStatus: true,
                    reason: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: "desc" },
                  take: 12,
                },
              },
            },
          },
        },
      },
    });
    if (!task)
      throw new NotFoundException("Task not found or not assigned to you");
    return serializeBigInts(task);
  }
}

function serializeBigInts<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;
}

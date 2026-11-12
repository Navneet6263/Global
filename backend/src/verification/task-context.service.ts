import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { resolveTaskAccessScope } from "./task-query.helpers";
import { documentScope } from "./check-documents";

@Injectable()
export class TaskContextService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor, taskPublicId: string, departmentId?: string) {
    const access = await resolveTaskAccessScope(
      this.prisma,
      actor,
      departmentId,
    );
    const task = await this.prisma.checkTask.findFirst({
      where: { AND: [access, { publicId: taskPublicId }] },
      select: {
        publicId: true,
        status: true,
        createdAt: true,
        startedAt: true,
        blockedAt: true,
        completedAt: true,
        assignee: { select: { publicId: true, displayName: true } },
        check: {
          select: {
            id: true,
            publicId: true,
            type: true,
            initiationJson: true,
            initiatedAt: true,
            department: {
              select: { publicId: true, name: true, teamType: true },
            },
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
                  where: documentScope(actor),
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
                        reviewStatus: true,
                        reviewNote: true,
                        reviewedAt: true,
                        createdAt: true,
                      },
                      orderBy: { version: "desc" },
                      take: 25,
                    },
                  },
                  orderBy: { updatedAt: "desc" },
                },
                clarifications: {
                  select: {
                    publicId: true,
                    level: true,
                    status: true,
                    subject: true,
                    checkId: true,
                    requestedDocumentType: true,
                    submittedDocumentVersion: true,
                    opsReviewedAt: true,
                    reentryCompletedAt: true,
                    rejectionCount: true,
                    lastRejectedReason: true,
                    submittedDocument: {
                      select: {
                        publicId: true,
                        type: true,
                        status: true,
                        currentVersion: true,
                      },
                    },
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
    const {
      id: checkInternalId,
      department,
      case: { clarifications, ...caseRest },
      ...checkRest
    } = task.check;
    const { assignee, ...taskRest } = task as typeof task & {
      assignee?: { publicId: string; displayName: string } | null;
    };
    return serializeBigInts({
      ...taskRest,
      assignee: assignee
        ? { id: assignee.publicId, name: assignee.displayName }
        : null,
      check: {
        ...checkRest,
        department: department
          ? {
              id: department.publicId,
              name: department.name,
              teamType: department.teamType,
            }
          : null,
        case: {
          ...caseRest,
          clarifications: clarifications.map((item) => ({
            publicId: item.publicId,
            level: item.level,
            status: item.status,
            subject: item.subject,
            isForCurrentCheck:
              checkInternalId !== undefined && item.checkId === checkInternalId,
            requestedDocumentType: item.requestedDocumentType,
            submittedDocumentVersion: item.submittedDocumentVersion,
            submittedDocument: item.submittedDocument
              ? {
                  id: item.submittedDocument.publicId,
                  type: item.submittedDocument.type,
                  status: item.submittedDocument.status,
                  currentVersion: item.submittedDocument.currentVersion,
                }
              : null,
            opsReviewedAt: item.opsReviewedAt,
            reentryCompletedAt: item.reentryCompletedAt,
            rejectionCount: item.rejectionCount,
            lastRejectedReason: item.lastRejectedReason,
            dueAt: item.dueAt,
            createdAt: item.createdAt,
          })),
        },
      },
    });
  }
}

function serializeBigInts<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;
}

import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { assertPrivacyAdmin, privacyTrackingNotice } from "./privacy-policy";
import type { PrivacyQueryDto } from "./privacy.dto";

export const privacyRecordSelect = {
  publicId: true,
  kind: true,
  title: true,
  description: true,
  subjectReference: true,
  requestType: true,
  status: true,
  severity: true,
  dueAt: true,
  resolutionNote: true,
  evidenceReference: true,
  completedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { publicId: true, displayName: true } },
  updatedBy: { select: { publicId: true, displayName: true } },
} as const;

@Injectable()
export class PrivacyQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: PrivacyQueryDto) {
    assertPrivacyAdmin(actor);
    const search = query.search?.trim();
    const where = {
      tenantId: actor.tenantId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { subjectReference: { contains: search } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction(
      [
        this.prisma.privacyRecord.count({ where }),
        this.prisma.privacyRecord.findMany({
          where,
          select: privacyRecordSelect,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return {
      items: rows.map(({ publicId, ...row }) => ({ id: publicId, ...row })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      trackingNotice: privacyTrackingNotice,
    };
  }

  async get(actor: Actor, publicId: string) {
    assertPrivacyAdmin(actor);
    const record = await this.prisma.privacyRecord.findFirst({
      where: { tenantId: actor.tenantId, publicId },
      select: privacyRecordSelect,
    });
    if (!record) throw new NotFoundException("Privacy record not found");
    return {
      id: record.publicId,
      ...record,
      trackingNotice: privacyTrackingNotice,
    };
  }

  async events(actor: Actor, publicId: string, query: PrivacyQueryDto) {
    await this.get(actor, publicId);
    const where = {
      tenantId: actor.tenantId,
      resourceType: "privacy_record",
      resourcePublicId: publicId,
    };
    const [total, rows] = await this.prisma.$transaction(
      [
        this.prisma.auditEvent.count({ where }),
        this.prisma.auditEvent.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            publicId: true,
            action: true,
            beforeJson: true,
            afterJson: true,
            createdAt: true,
            actor: { select: { publicId: true, displayName: true } },
          },
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return {
      items: rows.map(({ publicId: id, beforeJson, afterJson, ...row }) => ({
        id,
        ...row,
        before: beforeJson
          ? (JSON.parse(beforeJson) as Record<string, unknown>)
          : null,
        after: afterJson
          ? (JSON.parse(afterJson) as Record<string, unknown>)
          : null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }
}

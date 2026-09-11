import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { PrismaService } from "../database/prisma.service";

export class RetentionPreviewQuery {
  @Type(() => Number) @IsInt() @Min(30) @Max(3650) days = 365;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @IsOptional() @IsString() @Length(1, 40) search?: string;
  @IsIn(["ALL", "HELD", "REVIEW"]) mode = "ALL";
}
export class RetentionHoldDto {
  @IsInt() @Min(1) version!: number;
  @IsBoolean() hold!: boolean;
  @IsString() @Length(10, 500) reason!: string;
}

@Controller("privacy-retention")
@RequireRoles("PLATFORM_ADMIN")
@RequirePermissions(Permission.SettingsManage)
export class RetentionPreviewController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async preview(
    @CurrentActor() actor: Actor,
    @Query() input: RetentionPreviewQuery,
  ) {
    const cutoff = new Date(Date.now() - input.days * 86_400_000);
    const where = {
      tenantId: actor.tenantId,
      ...(input.search?.trim()
        ? { caseNumber: { contains: input.search.trim() } }
        : {}),
      ...(input.mode === "HELD"
        ? { retentionHoldAt: { not: null } }
        : input.mode === "REVIEW"
          ? {
              status: "CLOSED",
              completedAt: { lte: cutoff },
              retentionHoldAt: null,
            }
          : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.verificationCase.count({ where }),
      this.prisma.verificationCase.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { publicId: "asc" }],
        skip: (input.page - 1) * 12,
        take: 12,
        select: {
          publicId: true,
          caseNumber: true,
          status: true,
          completedAt: true,
          retentionHoldAt: true,
          retentionHoldReason: true,
          version: true,
          _count: {
            select: { documents: true, reports: true, fieldVisits: true },
          },
        },
      }),
    ]);
    return {
      items: rows.map(({ publicId, ...row }) => ({
        id: publicId,
        ...row,
        needsReview:
          row.status === "CLOSED" &&
          !!row.completedAt &&
          row.completedAt <= cutoff &&
          !row.retentionHoldAt,
      })),
      total,
      page: input.page,
      pageSize: 12,
      previewDays: input.days,
      executionEnabled: false,
    };
  }
  @Patch(":caseId/hold")
  async hold(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) id: string,
    @Body() input: RetentionHoldDto,
  ) {
    if (input.reason.trim().length < 10)
      throw new BadRequestException("Record the hold or release rationale");
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.verificationCase.findFirst({
        where: { tenantId: actor.tenantId, publicId: id },
        select: { id: true, retentionHoldAt: true },
      });
      if (!row) throw new NotFoundException("Case not found");
      if (Boolean(row.retentionHoldAt) === input.hold)
        throw new ConflictException("The requested hold state is already set");
      const changed = await tx.verificationCase.updateMany({
        where: { id: row.id, version: input.version },
        data: {
          retentionHoldAt: input.hold ? new Date() : null,
          retentionHoldReason: input.reason.trim(),
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new ConflictException(
          "Case changed; refresh before changing its hold",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: input.hold
            ? "case.retention-held"
            : "case.retention-hold-released",
          resourceType: "case",
          resourcePublicId: id,
          afterJson: JSON.stringify({
            hold: input.hold,
            reason: input.reason.trim(),
            version: input.version + 1,
          }),
        },
      });
      return {
        hold: input.hold,
        version: input.version + 1,
        deletionTriggered: false,
      };
    });
  }
}

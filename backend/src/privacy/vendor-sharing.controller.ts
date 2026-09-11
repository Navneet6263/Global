import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { PrismaService } from "../database/prisma.service";
import {
  CreateVendorSharingDto,
  VendorSharingDecisionDto,
  VendorSharingQuery,
} from "./vendor-sharing.dto";

export function assertSharingDecision(
  row: { status: string; expiresAt: Date; createdById: bigint },
  status: string,
  actorId: bigint,
  now = new Date(),
) {
  if (
    !(
      row.status === "PROPOSED"
        ? ["AUTHORISED", "REJECTED"]
        : row.status === "AUTHORISED"
          ? ["REVOKED"]
          : []
    ).includes(status)
  )
    throw new ConflictException(
      "This sharing decision is not available from the current state",
    );
  if (
    status === "AUTHORISED" &&
    (row.createdById === actorId || row.expiresAt <= now)
  )
    throw new ForbiddenException(
      "A different admin must approve an unexpired sharing scope",
    );
}

@Controller("privacy-vendor-sharing")
@RequireRoles("PLATFORM_ADMIN")
@RequirePermissions(Permission.SettingsManage)
export class VendorSharingController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list(@CurrentActor() actor: Actor, @Query() query: VendorSharingQuery) {
    const where = {
      tenantId: actor.tenantId,
      ...(query.search?.trim()
        ? { recipient: { contains: query.search.trim() } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.vendorSharingRecord.count({ where }),
      this.prisma.vendorSharingRecord.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (query.page - 1) * 12,
        take: 12,
      }),
    ]);
    return {
      total,
      page: query.page,
      items: rows.map((row) => ({
        id: row.publicId,
        recipient: row.recipient,
        purpose: row.purpose,
        agreementReference: row.agreementReference,
        scopeReference: row.scopeReference,
        expiresAt: row.expiresAt,
        status: row.status,
        decisionReason: row.decisionReason,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        categories: JSON.parse(row.categoriesJson) as string[],
        isAuthor: actor.userId === row.createdById,
        effectiveStatus:
          row.status === "AUTHORISED" && row.expiresAt <= new Date()
            ? "EXPIRED"
            : row.status,
      })),
    };
  }
  @Post()
  async create(
    @CurrentActor() actor: Actor,
    @Body() input: CreateVendorSharingDto,
  ) {
    const expiresAt = new Date(input.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())
      throw new BadRequestException("Sharing authority needs a future expiry");
    if (
      input.recipient.trim().length < 2 ||
      input.purpose.trim().length < 10 ||
      input.agreementReference.trim().length < 3 ||
      input.scopeReference.trim().length < 3
    )
      throw new BadRequestException(
        "Record the recipient, purpose, signed DPA and case/client scope",
      );
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.vendorSharingRecord.create({
        data: {
          tenantId: actor.tenantId,
          recipient: input.recipient.trim(),
          purpose: input.purpose.trim(),
          agreementReference: input.agreementReference.trim(),
          scopeReference: input.scopeReference.trim(),
          categoriesJson: JSON.stringify(input.categories),
          expiresAt,
          createdById: actor.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "privacy.sharing-proposed",
          resourceType: "vendor_sharing",
          resourcePublicId: row.publicId,
          afterJson: JSON.stringify({
            recipient: row.recipient,
            scopeReference: row.scopeReference,
            categories: input.categories,
            expiresAt,
          }),
        },
      });
      return { id: row.publicId };
    });
  }
  @Patch(":recordId")
  async decide(
    @CurrentActor() actor: Actor,
    @Param("recordId", ParseUUIDPipe) id: string,
    @Body() input: VendorSharingDecisionDto,
  ) {
    if (input.reason.trim().length < 10)
      throw new BadRequestException("Record the decision rationale");
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.vendorSharingRecord.findFirst({
        where: { publicId: id, tenantId: actor.tenantId },
      });
      if (!row) throw new NotFoundException("Sharing record not found");
      assertSharingDecision(row, input.status, actor.userId);
      const changed = await tx.vendorSharingRecord.updateMany({
        where: { id: row.id, version: input.version, status: row.status },
        data: {
          status: input.status,
          decisionReason: input.reason.trim(),
          decidedById: actor.userId,
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new ConflictException(
          "Sharing record changed; refresh before deciding",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "privacy.sharing-decided",
          resourceType: "vendor_sharing",
          resourcePublicId: id,
          beforeJson: JSON.stringify({ status: row.status }),
          afterJson: JSON.stringify({
            status: input.status,
            reason: input.reason.trim(),
          }),
        },
      });
      return { status: input.status, version: input.version + 1 };
    });
  }
  @Get(":recordId/events")
  async events(
    @CurrentActor() actor: Actor,
    @Param("recordId", ParseUUIDPipe) id: string,
    @Query() query: VendorSharingQuery,
  ) {
    const exists = await this.prisma.vendorSharingRecord.count({
      where: { publicId: id, tenantId: actor.tenantId },
    });
    if (!exists) throw new NotFoundException("Sharing record not found");
    const where = {
      tenantId: actor.tenantId,
      resourceType: "vendor_sharing",
      resourcePublicId: id,
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (query.page - 1) * 8,
        take: 8,
        select: {
          publicId: true,
          action: true,
          createdAt: true,
          afterJson: true,
          actor: { select: { displayName: true } },
        },
      }),
    ]);
    return {
      total,
      items: rows.map(({ publicId, afterJson, ...row }) => ({
        id: publicId,
        ...row,
        detail: afterJson
          ? (JSON.parse(afterJson) as { status?: string; reason?: string })
          : null,
      })),
    };
  }
}

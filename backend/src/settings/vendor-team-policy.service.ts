import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import {
  VENDOR_TEAM_MAX_LIMIT,
  activeTeamWhere,
} from "../vendor-requests/services/vendor-team-rules";
import type { UpdateVendorTeamLimitDto } from "./dto/update-vendor-team-limit.dto";

/** A Main Vendor: VENDOR role and not part of another vendor's team. */
const mainVendorWhere = (tenantId: bigint) => ({
  tenantId,
  vendorOwnerId: null,
  userRoles: { some: { role: { code: "VENDOR" } } },
});

/**
 * Per-Main-Vendor team limits (Platform Admin). Versioned and audited like the other
 * access policies. A limit can never be set below the vendor's ACTIVE team count, so
 * active team users never exceed it.
 */
@Injectable()
export class VendorTeamPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor) {
    const vendors = await this.prisma.user.findMany({
      where: mainVendorWhere(actor.tenantId),
      select: {
        id: true,
        publicId: true,
        displayName: true,
        email: true,
        status: true,
        vendorTeamPolicy: { select: { maxActiveUsers: true, version: true } },
      },
      orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
      take: 500,
    });
    const teams = await this.prisma.user.groupBy({
      by: ["vendorOwnerId", "status"],
      where: {
        tenantId: actor.tenantId,
        vendorOwnerId: { in: vendors.map((vendor) => vendor.id) },
      },
      _count: { _all: true },
    });
    const count = (ownerId: bigint, active: boolean) =>
      teams
        .filter(
          (group) =>
            group.vendorOwnerId === ownerId &&
            (group.status === "ACTIVE") === active,
        )
        .reduce((sum, group) => sum + group._count._all, 0);
    return {
      maxLimit: VENDOR_TEAM_MAX_LIMIT,
      items: vendors.map((vendor) => ({
        id: vendor.publicId,
        name: vendor.displayName,
        email: vendor.email,
        status: vendor.status,
        limit: vendor.vendorTeamPolicy?.maxActiveUsers ?? 0,
        version: vendor.vendorTeamPolicy?.version ?? 0,
        activeTeamUsers: count(vendor.id, true),
        inactiveTeamUsers: count(vendor.id, false),
      })),
    };
  }

  async update(
    actor: Actor,
    vendorPublicId: string,
    input: UpdateVendorTeamLimitDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.user.findFirst({
        where: { ...mainVendorWhere(actor.tenantId), publicId: vendorPublicId },
        select: {
          id: true,
          publicId: true,
          displayName: true,
          vendorTeamPolicy: {
            select: {
              id: true,
              publicId: true,
              maxActiveUsers: true,
              version: true,
            },
          },
        },
      });
      if (!vendor) throw new NotFoundException("Vendor account not found");
      const current = vendor.vendorTeamPolicy;
      if ((current?.version ?? 0) !== input.version)
        throw new ConflictException("Limit changed; refresh and try again");
      // Same lock as team creation, so a create cannot slip in while we compare.
      await tx.user.updateMany({
        where: { id: vendor.id },
        data: { updatedAt: new Date() },
      });
      const active = await tx.user.count({
        where: activeTeamWhere(actor.tenantId, vendor.id),
      });
      if (input.maxActiveUsers < active)
        throw new ConflictException(
          `${vendor.displayName} has ${active} active team user${active === 1 ? "" : "s"}; suspend some before lowering the limit to ${input.maxActiveUsers}`,
        );
      const policy = current
        ? await this.save(tx, current, input.maxActiveUsers, actor.userId)
        : await tx.vendorTeamPolicy.create({
            data: {
              tenantId: actor.tenantId,
              vendorUserId: vendor.id,
              maxActiveUsers: input.maxActiveUsers,
              updatedById: actor.userId,
            },
            select: { publicId: true, maxActiveUsers: true, version: true },
          });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "settings.vendor-team-limit.updated",
          resourceType: "vendor-team-policy",
          resourcePublicId: policy.publicId,
          beforeJson: JSON.stringify({ limit: current?.maxActiveUsers ?? 0 }),
          afterJson: JSON.stringify({
            vendorId: vendor.publicId,
            limit: policy.maxActiveUsers,
            activeTeamUsers: active,
            version: policy.version,
          }),
        },
      });
      return {
        id: vendor.publicId,
        limit: policy.maxActiveUsers,
        version: policy.version,
        activeTeamUsers: active,
      };
    });
  }

  private async save(
    tx: Prisma.TransactionClient,
    current: { id: bigint; version: number },
    maxActiveUsers: number,
    updatedById: bigint,
  ) {
    const updated = await tx.vendorTeamPolicy.updateMany({
      where: { id: current.id, version: current.version },
      data: { maxActiveUsers, updatedById, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new ConflictException("Limit was updated concurrently; refresh");
    return tx.vendorTeamPolicy.findUniqueOrThrow({
      where: { id: current.id },
      select: { publicId: true, maxActiveUsers: true, version: true },
    });
  }
}

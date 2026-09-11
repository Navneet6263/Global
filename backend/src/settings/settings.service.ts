import { ConflictException, Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CreateBranchDto } from "./dto/create-branch.dto";
import type { CreateServicePackageDto } from "./dto/create-service-package.dto";
import type { UpdateFieldPolicyDto } from "./dto/update-field-policy.dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  organisation(actor: Actor) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: actor.tenantId },
      select: {
        publicId: true,
        name: true,
        timezone: true,
        status: true,
      },
    });
  }

  fieldPolicy(actor: Actor) {
    return this.prisma.tenantFieldPolicy.upsert({
      where: { tenantId: actor.tenantId },
      update: {},
      create: { tenantId: actor.tenantId },
      select: {
        publicId: true,
        defaultRadiusMeters: true,
        maxAccuracyMeters: true,
        minimumPhotos: true,
        retentionDays: true,
        requireCheckout: true,
        outsideGeofencePolicy: true,
        version: true,
        updatedAt: true,
      },
    });
  }

  async updateFieldPolicy(actor: Actor, input: UpdateFieldPolicyDto) {
    const existing = await this.prisma.tenantFieldPolicy.findUnique({
      where: { tenantId: actor.tenantId },
      select: { id: true, publicId: true, version: true },
    });
    if (!existing) {
      await this.fieldPolicy(actor);
      throw new ConflictException(
        "Policy was initialised; refresh and save again",
      );
    }
    if (existing.version !== input.version)
      throw new ConflictException("Policy changed; refresh and try again");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantFieldPolicy.updateMany({
        where: { id: existing.id, version: input.version },
        data: {
          defaultRadiusMeters: input.defaultRadiusMeters,
          maxAccuracyMeters: input.maxAccuracyMeters,
          minimumPhotos: input.minimumPhotos,
          retentionDays: input.retentionDays,
          requireCheckout: input.requireCheckout,
          outsideGeofencePolicy: input.outsideGeofencePolicy,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Policy was updated concurrently");
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "settings.field-policy.updated",
          resourceType: "tenant-field-policy",
          resourcePublicId: existing.publicId,
          afterJson: JSON.stringify({ ...input, version: input.version + 1 }),
        },
      });
      return tx.tenantFieldPolicy.findUniqueOrThrow({
        where: { id: existing.id },
        select: {
          publicId: true,
          defaultRadiusMeters: true,
          maxAccuracyMeters: true,
          minimumPhotos: true,
          retentionDays: true,
          requireCheckout: true,
          outsideGeofencePolicy: true,
          version: true,
          updatedAt: true,
        },
      });
    });
  }

  async branches(actor: Actor) {
    const items = await this.prisma.branch.findMany({
      where: { tenantId: actor.tenantId },
      select: {
        publicId: true,
        code: true,
        name: true,
        city: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            users: {
              where: {
                status: "ACTIVE",
                userRoles: { some: { role: { code: "FIELD_EXECUTIVE" } } },
              },
            },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return {
      items: items.map(({ publicId, _count, ...item }) => ({
        id: publicId,
        ...item,
        fieldExecutiveCount: _count.users,
      })),
    };
  }

  async createBranch(actor: Actor, input: CreateBranchDto) {
    const code = input.code.trim().toUpperCase();
    const exists = await this.prisma.branch.findFirst({
      where: { tenantId: actor.tenantId, code },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException("A branch with this code already exists");
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.branch.create({
        data: {
          tenantId: actor.tenantId,
          code,
          name: input.name.trim(),
          city: input.city?.trim(),
        },
        select: {
          publicId: true,
          code: true,
          name: true,
          city: true,
          isActive: true,
          createdAt: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "settings.branch.created",
          resourceType: "branch",
          resourcePublicId: row.publicId,
        },
      });
      const { publicId, ...branch } = row;
      return { id: publicId, ...branch };
    });
  }

  async packages(actor: Actor) {
    const rows = await this.prisma.servicePackage.findMany({
      where: { tenantId: actor.tenantId },
      select: {
        publicId: true,
        code: true,
        name: true,
        checksJson: true,
        serviceFamily: true,
        requiredDocumentsJson: true,
        updatedAt: true,
        price: true,
        tatHours: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return {
      items: rows.map(
        ({ publicId, checksJson, requiredDocumentsJson, ...item }) => ({
          id: publicId,
          ...item,
          checks: this.parseChecks(checksJson),
          requiredDocuments: this.parseChecks(requiredDocumentsJson),
        }),
      ),
    };
  }

  async createPackage(actor: Actor, input: CreateServicePackageDto) {
    const code = input.code.trim().toUpperCase();
    const exists = await this.prisma.servicePackage.findFirst({
      where: { tenantId: actor.tenantId, code },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException(
        "A service package with this code already exists",
      );
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.servicePackage.create({
        data: {
          tenantId: actor.tenantId,
          code,
          name: input.name.trim(),
          checksJson: JSON.stringify(input.checks),
          serviceFamily: input.serviceFamily,
          requiredDocumentsJson: JSON.stringify(input.requiredDocuments),
          price: input.price,
          tatHours: input.tatHours,
        },
        select: {
          publicId: true,
          code: true,
          name: true,
          price: true,
          tatHours: true,
          isActive: true,
          createdAt: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "settings.service-package.created",
          resourceType: "service-package",
          resourcePublicId: row.publicId,
        },
      });
      const { publicId, ...servicePackage } = row;
      return {
        id: publicId,
        ...servicePackage,
        checks: input.checks,
        serviceFamily: input.serviceFamily,
        requiredDocuments: input.requiredDocuments,
      };
    });
  }

  private parseChecks(value: string): string[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  }
}

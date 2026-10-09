import { ConflictException, Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { UpdateAccessPolicyDto } from "./dto/update-access-policy.dto";

const accessPolicySelect = {
  publicId: true,
  opsUserCreationEnabled: true,
  releaseBeforePayment: true,
  branchScopingEnabled: true,
  version: true,
  updatedAt: true,
} as const;

/** Platform Admin delegation switches, versioned and audited like the field policy. */
@Injectable()
export class AccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  get(actor: Actor) {
    return this.prisma.tenantAccessPolicy.upsert({
      where: { tenantId: actor.tenantId },
      update: {},
      create: { tenantId: actor.tenantId },
      select: accessPolicySelect,
    });
  }

  async update(actor: Actor, input: UpdateAccessPolicyDto) {
    const existing = await this.prisma.tenantAccessPolicy.findUnique({
      where: { tenantId: actor.tenantId },
      select: { id: true, publicId: true, version: true },
    });
    if (!existing) {
      await this.get(actor);
      throw new ConflictException(
        "Policy was initialised; refresh and save again",
      );
    }
    if (existing.version !== input.version)
      throw new ConflictException("Policy changed; refresh and try again");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantAccessPolicy.updateMany({
        where: { id: existing.id, version: input.version },
        data: {
          opsUserCreationEnabled: input.opsUserCreationEnabled,
          ...(input.releaseBeforePayment === undefined
            ? {}
            : { releaseBeforePayment: input.releaseBeforePayment }),
          ...(input.branchScopingEnabled === undefined
            ? {}
            : { branchScopingEnabled: input.branchScopingEnabled }),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Policy was updated concurrently");
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "settings.access-policy.updated",
          resourceType: "tenant-access-policy",
          resourcePublicId: existing.publicId,
          afterJson: JSON.stringify({
            opsUserCreationEnabled: input.opsUserCreationEnabled,
            ...(input.releaseBeforePayment === undefined
              ? {}
              : { releaseBeforePayment: input.releaseBeforePayment }),
            ...(input.branchScopingEnabled === undefined
              ? {}
              : { branchScopingEnabled: input.branchScopingEnabled }),
            version: input.version + 1,
          }),
        },
      });
      return tx.tenantAccessPolicy.findUniqueOrThrow({
        where: { id: existing.id },
        select: accessPolicySelect,
      });
    });
  }
}

import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import { hashPassword, verifyPassword } from "./password";

@Injectable()
export class AccountPasswordService {
  constructor(private readonly prisma: PrismaService) {}

  async change(actor: Actor, input: ChangePasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.userId, tenantId: actor.tenantId, status: "ACTIVE" },
      select: { id: true, publicId: true, passwordHash: true },
    });
    if (
      !user ||
      !(await verifyPassword(input.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException("Current password is incorrect");
    }
    if (await verifyPassword(input.newPassword, user.passwordHash)) {
      throw new UnauthorizedException(
        "New password must be different from the current password",
      );
    }
    const passwordHash = await hashPassword(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
          version: { increment: 1 },
        },
      });
      await tx.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "auth.password.changed",
          resourceType: "user",
          resourcePublicId: user.publicId,
        },
      });
    });
    return { changed: true };
  }
}

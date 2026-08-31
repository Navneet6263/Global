import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { LoginDto } from "./dto/login.dto";
import { verifyPassword } from "./password";
import { AuthTokenService } from "./auth-token.service";
import type { RequestMeta } from "./auth.types";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60_000;

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: AuthTokenService,
  ) {}

  async login(input: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.withTransientReadRetry(() =>
      this.prisma.user.findFirst({
        where: {
          normalizedEmail: input.email.trim().toLowerCase(),
          tenant: {
            code: input.tenantCode.trim().toUpperCase(),
            status: "ACTIVE",
          },
        },
        include: {
          tenant: true,
          branch: true,
          client: true,
          userRoles: { include: { role: true } },
        },
      }),
    );
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      if (user) await this.recordFailedLogin(user, meta);
      throw new UnauthorizedException("Invalid workspace, email, or password");
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account is temporarily locked");
    }

    const [, tokenPair] = await Promise.all([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      }),
      this.tokens.issue(
        {
          userId: user.id,
          userPublicId: user.publicId,
          tenantId: user.tenantId,
          tenantPublicId: user.tenant.publicId,
          branchPublicId: user.branch?.publicId,
          email: user.email,
        },
        meta,
      ),
    ]);
    await this.prisma.auditEvent.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "auth.login.succeeded",
        resourceType: "user",
        resourcePublicId: user.publicId,
        ipAddress: meta.ipAddress,
        afterJson: JSON.stringify({ userAgent: meta.userAgent?.slice(0, 300) }),
      },
    });
    return {
      tokens: tokenPair,
      session: {
        id: user.publicId,
        tenantId: user.tenant.publicId,
        tenantName: user.tenant.name,
        branchId: user.branch?.publicId,
        branchName: user.branch?.name,
        clientId: user.client?.publicId,
        clientName: user.client?.displayName,
        email: user.email,
        displayName: user.displayName,
        mustChangePassword: user.mustChangePassword,
        roles: user.userRoles.map(({ role }) => role.code),
        permissions: this.permissions(user.userRoles),
      },
    };
  }

  profile(actor: Actor) {
    return {
      id: actor.userPublicId,
      tenantId: actor.tenantPublicId,
      tenantName: actor.tenantName,
      branchId: actor.branchPublicId,
      branchName: actor.branchName,
      clientId: actor.clientPublicId,
      clientName: actor.clientName,
      email: actor.email,
      displayName: actor.displayName,
      mustChangePassword: actor.mustChangePassword,
      roles: actor.roles,
      permissions: actor.permissions,
    };
  }

  private async recordFailedLogin(
    user: {
      id: bigint;
      publicId: string;
      tenantId: bigint;
      failedLoginCount: number;
      lockedUntil: Date | null;
    },
    meta: RequestMeta,
  ): Promise<void> {
    const failedLoginCount = user.failedLoginCount + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil:
            failedLoginCount >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCKOUT_MS)
              : user.lockedUntil,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "auth.login.failed",
          resourceType: "user",
          resourcePublicId: user.publicId,
          ipAddress: meta.ipAddress,
          afterJson: JSON.stringify({
            failedLoginCount,
            locked: failedLoginCount >= MAX_FAILED_LOGINS,
          }),
        },
      });
    });
  }

  private permissions(
    assignments: Array<{ role: { permissionsJson: string } }>,
  ): string[] {
    return [
      ...new Set(
        assignments.flatMap(({ role }) => {
          try {
            return JSON.parse(role.permissionsJson) as string[];
          } catch {
            return [];
          }
        }),
      ),
    ];
  }
}

import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { LoginDto } from "./dto/login.dto";
import { hashPassword, verifyPassword } from "./password";
import type { ChangePasswordDto } from "./dto/change-password.dto";

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60_000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(input: LoginDto, meta: RequestMeta) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.prisma.withTransientReadRetry(() =>
      this.prisma.user.findFirst({
        where: {
          normalizedEmail,
          tenant: {
            code: input.tenantCode.trim().toUpperCase(),
            status: "ACTIVE",
          },
        },
        include: {
          tenant: true,
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
      if (user) {
        const failedLoginCount = user.failedLoginCount + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount,
            lockedUntil:
              failedLoginCount >= MAX_FAILED_LOGINS
                ? new Date(Date.now() + LOCKOUT_MS)
                : user.lockedUntil,
          },
        });
      }
      throw new UnauthorizedException("Invalid workspace, email, or password");
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account is temporarily locked");
    }

    const [, tokens] = await Promise.all([
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
      }),
      this.issueTokens(
        user.id,
        user.publicId,
        user.tenantId,
        user.tenant.publicId,
        user.email,
        meta,
      ),
    ]);
    const roles = user.userRoles.map(({ role }) => role.code);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap(({ role }) => {
          try {
            return JSON.parse(role.permissionsJson) as string[];
          } catch {
            return [];
          }
        }),
      ),
    ];
    return {
      tokens,
      session: {
        id: user.publicId,
        tenantId: user.tenant.publicId,
        tenantName: user.tenant.name,
        clientId: user.client?.publicId,
        clientName: user.client?.displayName,
        email: user.email,
        displayName: user.displayName,
        mustChangePassword: user.mustChangePassword,
        roles,
        permissions,
      },
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    const secret = this.config.getOrThrow<string>("JWT_REFRESH_SECRET");
    let payload: {
      sub: string;
      tenantId: string;
      sessionId: string;
      type: string;
    };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException("Refresh session is invalid or expired");
    }
    if (payload.type !== "refresh")
      throw new UnauthorizedException("Invalid token type");

    const session = await this.prisma.refreshSession.findFirst({
      where: {
        publicId: payload.sessionId,
        tokenHash: this.digest(refreshToken),
        user: { publicId: payload.sub },
      },
      include: { user: { include: { tenant: true } } },
    });
    if (!session || session.user.tenant.publicId !== payload.tenantId)
      throw new UnauthorizedException("Refresh session is invalid or expired");
    if (session.revokedAt) {
      await this.revokeFamily(
        session.userId,
        session.familyId,
        session.user.tenantId,
      );
      throw new UnauthorizedException(
        "Refresh token reuse detected; session family revoked",
      );
    }
    if (session.expiresAt <= new Date() || session.user.status !== "ACTIVE") {
      throw new UnauthorizedException("Refresh session is invalid or expired");
    }

    const rotated = await this.prisma.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (rotated.count !== 1) {
      await this.revokeFamily(
        session.userId,
        session.familyId,
        session.user.tenantId,
      );
      throw new UnauthorizedException(
        "Refresh token reuse detected; session family revoked",
      );
    }
    const { user } = session;
    return this.issueTokens(
      user.id,
      user.publicId,
      user.tenantId,
      user.tenant.publicId,
      user.email,
      meta,
      session.familyId,
    );
  }

  async revoke(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: this.digest(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  profile(actor: Actor) {
    return {
      id: actor.userPublicId,
      tenantId: actor.tenantPublicId,
      tenantName: actor.tenantName,
      clientId: actor.clientPublicId,
      clientName: actor.clientName,
      email: actor.email,
      displayName: actor.displayName,
      mustChangePassword: actor.mustChangePassword,
      roles: actor.roles,
      permissions: actor.permissions,
    };
  }

  async sessions(actor: Actor) {
    const currentSessionId = this.currentSessionId(actor);
    const now = new Date();
    const rows = await this.prisma.refreshSession.findMany({
      where: {
        userId: actor.userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        publicId: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return {
      items: rows.map(({ publicId, ...row }) => ({
        id: publicId,
        ...row,
        current: publicId === currentSessionId,
      })),
    };
  }

  async revokeOtherSessions(actor: Actor) {
    const currentSessionId = this.currentSessionId(actor);
    const current = await this.prisma.refreshSession.findFirst({
      where: {
        userId: actor.userId,
        publicId: currentSessionId,
        revokedAt: null,
      },
      select: { familyId: true },
    });
    if (!current)
      throw new UnauthorizedException("Current session is unavailable");
    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: {
          userId: actor.userId,
          revokedAt: null,
          familyId: { not: current.familyId },
        },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "auth.sessions.others-revoked",
          resourceType: "user",
          resourcePublicId: actor.userPublicId,
          afterJson: JSON.stringify({ revoked: revoked.count }),
        },
      });
      return { revoked: revoked.count };
    });
  }

  async revokeSession(actor: Actor, sessionPublicId: string) {
    const currentSessionId = this.currentSessionId(actor);
    const target = await this.prisma.refreshSession.findFirst({
      where: {
        userId: actor.userId,
        publicId: sessionPublicId,
        revokedAt: null,
      },
      select: { familyId: true },
    });
    if (!target) throw new NotFoundException("Active session not found");
    const current = sessionPublicId === currentSessionId;
    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: {
          userId: actor.userId,
          familyId: target.familyId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "auth.session.revoked",
          resourceType: "user",
          resourcePublicId: actor.userPublicId,
          afterJson: JSON.stringify({
            sessionId: sessionPublicId,
            current,
            revoked: revoked.count,
          }),
        },
      });
      return { revoked: revoked.count, current };
    });
  }

  async changePassword(actor: Actor, input: ChangePasswordDto) {
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

  private async issueTokens(
    userId: bigint,
    userPublicId: string,
    tenantId: bigint,
    tenantPublicId: string,
    email: string,
    meta: RequestMeta,
    familyId?: string,
  ): Promise<TokenPair> {
    const refreshTtl = this.config.get<string>("JWT_REFRESH_TTL", "7d");
    const refreshExpiresAt = new Date(Date.now() + this.ttlMs(refreshTtl));
    const sessionPublicId = randomUUID();
    const resolvedFamilyId = familyId ?? randomUUID();
    const accessToken = await this.jwt.signAsync(
      {
        sub: userPublicId,
        tenantId: tenantPublicId,
        email,
        sessionId: sessionPublicId,
        type: "access",
      },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get("JWT_ACCESS_TTL", "15m"),
      },
    );
    const refreshToken = await this.jwt.signAsync(
      {
        sub: userPublicId,
        tenantId: tenantPublicId,
        sessionId: sessionPublicId,
        type: "refresh",
      },
      {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: refreshTtl as JwtSignOptions["expiresIn"],
      },
    );
    await this.prisma.refreshSession.create({
      data: {
        publicId: sessionPublicId,
        userId,
        familyId: resolvedFamilyId,
        tokenHash: this.digest(refreshToken),
        userAgent: meta.userAgent?.slice(0, 500),
        ipAddress: meta.ipAddress?.slice(0, 64),
        expiresAt: refreshExpiresAt,
      },
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private currentSessionId(actor: Actor): string {
    if (!actor.sessionPublicId) {
      throw new UnauthorizedException("Current session is unavailable");
    }
    return actor.sessionPublicId;
  }

  private async revokeFamily(
    userId: bigint,
    familyId: string,
    tenantId: bigint,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshSession.updateMany({
        where: { userId, familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { publicId: true },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorUserId: userId,
          action: "auth.refresh-token-reuse-detected",
          resourceType: "user",
          resourcePublicId: user?.publicId,
          afterJson: JSON.stringify({ familyId }),
        },
      });
    });
  }

  private ttlMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 7 * 86_400_000;
    const amount = Number(match[1]);
    return (
      amount *
      ({ s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]!] ?? 1)
    );
  }
}

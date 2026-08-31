import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import type { RequestMeta, TokenIdentity, TokenPair } from "./auth.types";
import { ttlSeconds } from "../config/ttl";

interface RefreshPayload {
  sub: string;
  tenantId: string;
  sessionId: string;
  type: string;
}

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.refreshSession.findFirst({
      where: {
        publicId: payload.sessionId,
        tokenHash: this.digest(refreshToken),
        user: { publicId: payload.sub },
      },
      include: { user: { include: { tenant: true, branch: true } } },
    });
    if (!session || session.user.tenant.publicId !== payload.tenantId) {
      throw new UnauthorizedException("Refresh session is invalid or expired");
    }
    if (session.revokedAt) {
      await this.revokeFamily(
        session.userId,
        session.familyId,
        session.user.tenantId,
      );
      throw this.reuseDetected();
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
      throw this.reuseDetected();
    }
    const { user } = session;
    return this.issue(
      {
        userId: user.id,
        userPublicId: user.publicId,
        tenantId: user.tenantId,
        tenantPublicId: user.tenant.publicId,
        branchPublicId: user.branch?.publicId,
        email: user.email,
      },
      meta,
      session.familyId,
      session.deviceName,
    );
  }

  async revoke(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: this.digest(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async issue(
    identity: TokenIdentity,
    meta: RequestMeta,
    familyId?: string,
    deviceName?: string | null,
  ): Promise<TokenPair> {
    const isFreshLogin = !familyId;
    const nextFamilyId = familyId ?? randomUUID();
    const refreshTtl = this.config.get<string>("JWT_REFRESH_TTL", "7d");
    const refreshSeconds = ttlSeconds(refreshTtl);
    const accessSeconds = ttlSeconds(
      this.config.get<string>("JWT_ACCESS_TTL", "15m"),
    );
    const refreshExpiresAt = new Date(Date.now() + refreshSeconds * 1_000);
    const sessionPublicId = randomUUID();
    const commonClaims = {
      sub: identity.userPublicId,
      tenantId: identity.tenantPublicId,
      branchId: identity.branchPublicId,
      sessionId: sessionPublicId,
    };
    const accessToken = await this.jwt.signAsync(
      { ...commonClaims, email: identity.email, type: "access" },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: accessSeconds,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...commonClaims, type: "refresh" },
      {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: refreshSeconds,
      },
    );
    await this.prisma.$transaction(async (tx) => {
      if (isFreshLogin && meta.deviceKey) {
        await tx.refreshSession.updateMany({
          where: {
            userId: identity.userId,
            deviceKey: meta.deviceKey,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }
      await tx.refreshSession.create({
        data: {
          publicId: sessionPublicId,
          userId: identity.userId,
          familyId: nextFamilyId,
          tokenHash: this.digest(refreshToken),
          userAgent: meta.userAgent?.slice(0, 500),
          ipAddress: meta.ipAddress?.slice(0, 64),
          deviceKey: meta.deviceKey?.slice(0, 64),
          deviceName: deviceName?.slice(0, 80),
          locationLabel: meta.locationLabel?.slice(0, 160),
          expiresAt: refreshExpiresAt,
        },
      });
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
      if (payload.type !== "refresh") {
        throw new UnauthorizedException("Invalid token type");
      }
      return payload;
    } catch (error) {
      if (
        error instanceof UnauthorizedException &&
        error.message === "Invalid token type"
      ) {
        throw error;
      }
      throw new UnauthorizedException("Refresh session is invalid or expired");
    }
  }

  private async revokeFamily(
    userId: bigint,
    familyId: string,
    tenantId: bigint,
  ): Promise<void> {
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

  private reuseDetected(): UnauthorizedException {
    return new UnauthorizedException(
      "Refresh token reuse detected; session family revoked",
    );
  }

  private digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}

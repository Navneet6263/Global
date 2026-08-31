import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AccessTokenPayload, Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";

function cookieExtractor(request: {
  cookies?: Record<string, string>;
}): string | null {
  return request.cookies?.sg_access ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<Actor> {
    if (payload.type !== "access")
      throw new UnauthorizedException("Invalid token type");
    const user = await this.prisma.user.findFirst({
      where: {
        publicId: payload.sub,
        status: "ACTIVE",
        tenant: { publicId: payload.tenantId, status: "ACTIVE" },
        sessions: {
          some: {
            publicId: payload.sessionId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
      include: {
        tenant: true,
        branch: true,
        client: true,
        userRoles: { include: { role: true } },
      },
    });
    if (!user) throw new UnauthorizedException("Account is unavailable");
    if (payload.branchId && user.branch?.publicId !== payload.branchId) {
      throw new UnauthorizedException("Branch access has changed");
    }

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
      userId: user.id,
      userPublicId: user.publicId,
      tenantId: user.tenantId,
      tenantPublicId: user.tenant.publicId,
      tenantName: user.tenant.name,
      branchId: user.branchId ?? undefined,
      branchPublicId: user.branch?.publicId,
      branchName: user.branch?.name,
      clientId: user.clientId ?? undefined,
      clientPublicId: user.client?.publicId,
      clientName: user.client?.displayName,
      email: user.email,
      displayName: user.displayName,
      sessionPublicId: payload.sessionId,
      mustChangePassword: user.mustChangePassword,
      roles,
      permissions,
    };
  }
}

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

type AuthActorRow = {
  userId: bigint;
  userPublicId: string;
  tenantId: bigint;
  tenantPublicId: string;
  tenantName: string;
  branchId: bigint | null;
  branchPublicId: string | null;
  branchName: string | null;
  clientId: bigint | null;
  clientPublicId: string | null;
  clientName: string | null;
  email: string;
  displayName: string;
  mustChangePassword: boolean;
  roleCode: string;
  permissionsJson: string;
};

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
    // Recheck live session/account state on every request. Sharing cached actors
    // lets a completed revoke or scope change remain usable in other requests.
    return this.resolveActor(payload);
  }

  private async resolveActor(payload: AccessTokenPayload): Promise<Actor> {
    const rows = await this.prisma.$queryRaw<AuthActorRow[]>`
      SELECT
        u.[id] AS [userId],
        u.[publicId] AS [userPublicId],
        u.[tenantId] AS [tenantId],
        tenant.[publicId] AS [tenantPublicId],
        tenant.[name] AS [tenantName],
        u.[branchId] AS [branchId],
        branch.[publicId] AS [branchPublicId],
        branch.[name] AS [branchName],
        u.[clientId] AS [clientId],
        client.[publicId] AS [clientPublicId],
        client.[displayName] AS [clientName],
        u.[email] AS [email],
        u.[displayName] AS [displayName],
        u.[mustChangePassword] AS [mustChangePassword],
        role.[code] AS [roleCode],
        role.[permissionsJson] AS [permissionsJson]
      FROM [dbo].[RefreshSession] session
      INNER JOIN [dbo].[User] u ON u.[id] = session.[userId]
      INNER JOIN [dbo].[Tenant] tenant ON tenant.[id] = u.[tenantId]
      LEFT JOIN [dbo].[Branch] branch ON branch.[id] = u.[branchId]
      LEFT JOIN [dbo].[Client] client ON client.[id] = u.[clientId]
      INNER JOIN [dbo].[UserRole] userRole ON userRole.[userId] = u.[id]
      INNER JOIN [dbo].[Role] role ON role.[id] = userRole.[roleId]
      WHERE session.[publicId] = CAST(${payload.sessionId} AS UNIQUEIDENTIFIER)
        AND session.[revokedAt] IS NULL
        AND session.[expiresAt] > SYSUTCDATETIME()
        AND u.[publicId] = CAST(${payload.sub} AS UNIQUEIDENTIFIER)
        AND u.[status] = 'ACTIVE'
        AND tenant.[publicId] = CAST(${payload.tenantId} AS UNIQUEIDENTIFIER)
        AND tenant.[status] = 'ACTIVE'
    `;
    const user = rows[0];
    if (!user) throw new UnauthorizedException("Account is unavailable");
    if (payload.branchId && user.branchPublicId !== payload.branchId) {
      throw new UnauthorizedException("Branch access has changed");
    }

    const roles = [...new Set(rows.map((row) => row.roleCode))];
    const permissions = [
      ...new Set(
        rows.flatMap((row) => {
          try {
            return JSON.parse(row.permissionsJson) as string[];
          } catch {
            return [];
          }
        }),
      ),
    ];

    return {
      userId: user.userId,
      userPublicId: user.userPublicId,
      tenantId: user.tenantId,
      tenantPublicId: user.tenantPublicId,
      tenantName: user.tenantName,
      branchId: user.branchId ?? undefined,
      branchPublicId: user.branchPublicId ?? undefined,
      branchName: user.branchName ?? undefined,
      clientId: user.clientId ?? undefined,
      clientPublicId: user.clientPublicId ?? undefined,
      clientName: user.clientName ?? undefined,
      email: user.email,
      displayName: user.displayName,
      sessionPublicId: payload.sessionId,
      mustChangePassword: user.mustChangePassword,
      roles,
      permissions,
    };
  }
}

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
  clientStatus: string | null;
  email: string;
  displayName: string;
  mustChangePassword: boolean;
  vendorOwnerId: bigint | null;
  roleCode: string;
  branchScoping: boolean | null;
  baseRoleCode: string | null;
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
        client.[status] AS [clientStatus],
        u.[email] AS [email],
        u.[displayName] AS [displayName],
        u.[mustChangePassword] AS [mustChangePassword],
        u.[vendorOwnerId] AS [vendorOwnerId],
        role.[code] AS [roleCode],
        role.[baseRoleCode] AS [baseRoleCode],
        role.[permissionsJson] AS [permissionsJson],
        accessPolicy.[branchScopingEnabled] AS [branchScoping]
      FROM [dbo].[RefreshSession] session
      INNER JOIN [dbo].[User] u ON u.[id] = session.[userId]
      INNER JOIN [dbo].[Tenant] tenant ON tenant.[id] = u.[tenantId]
      LEFT JOIN [dbo].[Branch] branch ON branch.[id] = u.[branchId]
      LEFT JOIN [dbo].[Client] client ON client.[id] = u.[clientId]
      LEFT JOIN [dbo].[User] vendorOwner ON vendorOwner.[id] = u.[vendorOwnerId]
      INNER JOIN [dbo].[UserRole] userRole ON userRole.[userId] = u.[id]
      INNER JOIN [dbo].[Role] role ON role.[id] = userRole.[roleId]
      LEFT JOIN [dbo].[TenantAccessPolicy] accessPolicy ON accessPolicy.[tenantId] = u.[tenantId]
      WHERE session.[publicId] = CAST(${payload.sessionId} AS UNIQUEIDENTIFIER)
        AND session.[revokedAt] IS NULL
        AND session.[expiresAt] > SYSUTCDATETIME()
        AND u.[publicId] = CAST(${payload.sub} AS UNIQUEIDENTIFIER)
        AND u.[status] = 'ACTIVE'
        -- A vendor team login works only while its Main Vendor is active.
        AND (u.[vendorOwnerId] IS NULL OR vendorOwner.[status] = 'ACTIVE')
        AND tenant.[publicId] = CAST(${payload.tenantId} AS UNIQUEIDENTIFIER)
        AND tenant.[status] = 'ACTIVE'
    `;
    const user = rows[0];
    if (!user) throw new UnauthorizedException("Account is unavailable");
    // Branch (office) scoping is a tenant switch; while it is off nobody carries a branch,
    // so every branch filter in the application stops applying.
    const branchScoping = user.branchScoping === true;
    if (
      branchScoping &&
      payload.branchId &&
      user.branchPublicId !== payload.branchId
    ) {
      throw new UnauthorizedException("Branch access has changed");
    }

    // A custom role works as its system base role, with its own (narrower) permissions.
    const roles = [
      ...new Set(rows.map((row) => row.baseRoleCode ?? row.roleCode)),
    ];
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
      branchId: branchScoping ? (user.branchId ?? undefined) : undefined,
      branchPublicId: branchScoping
        ? (user.branchPublicId ?? undefined)
        : undefined,
      branchName: branchScoping ? (user.branchName ?? undefined) : undefined,
      branchScoping,
      clientId: user.clientId ?? undefined,
      clientPublicId: user.clientPublicId ?? undefined,
      clientName: user.clientName ?? undefined,
      clientStatus: user.clientStatus ?? undefined,
      email: user.email,
      displayName: user.displayName,
      sessionPublicId: payload.sessionId,
      mustChangePassword: user.mustChangePassword,
      roles,
      permissions,
      ...(user.vendorOwnerId ? { vendorOwnerId: user.vendorOwnerId } : {}),
      ...(roles.includes("SPOC_RM")
        ? { spocClients: await this.spocClients(user.userId, user.tenantId) }
        : {}),
      ...(roles.some((role) => ["DATA_ENTRY", "VERIFIER"].includes(role))
        ? { departments: await this.departments(user.userId, user.tenantId) }
        : {}),
    };
  }

  /** Live department membership: removal by an admin applies on the next request. */
  private async departments(userId: bigint, tenantId: bigint) {
    const rows = await this.prisma.departmentMember.findMany({
      where: { userId, department: { tenantId, status: "ACTIVE" } },
      select: {
        role: true,
        department: {
          select: {
            id: true,
            publicId: true,
            code: true,
            name: true,
            kind: true,
          },
        },
      },
    });
    return rows.map(({ role, department }) => ({
      ...department,
      role: role === "LEAD" ? ("LEAD" as const) : ("MEMBER" as const),
    }));
  }

  /** Live SPOC-RM client scope: a client removed by an admin stops working on the next request. */
  private async spocClients(userId: bigint, tenantId: bigint) {
    const rows = await this.prisma.spocClientScope.findMany({
      where: { userId, client: { tenantId } },
      select: {
        client: { select: { id: true, publicId: true, displayName: true } },
      },
      orderBy: { client: { displayName: "asc" } },
    });
    return rows.map(({ client }) => ({
      id: client.id,
      publicId: client.publicId,
      name: client.displayName,
    }));
  }
}

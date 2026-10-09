import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  isViewOnlyAdmin,
  VIEW_ONLY_PERMISSIONS,
} from "../common/auth/view-only";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { LoginDto } from "./dto/login.dto";
import { verifyPassword } from "./password";
import {
  DEFAULT_PASSWORD_MAX_AGE_DAYS,
  passwordExpired,
} from "./password-expiry";
import { AuthTokenService } from "./auth-token.service";
import type { RequestMeta } from "./auth.types";

const MAX_FAILED_LOGINS = 5;
const SIGN_IN_INCLUDE = {
  tenant: true,
  branch: true,
  client: true,
  userRoles: { include: { role: true } },
  vendorOwner: { select: { status: true } },
  spocClientScopes: {
    select: {
      client: { select: { publicId: true, displayName: true } },
    },
    orderBy: { client: { displayName: "asc" } },
  },
} as const;
const LOCKOUT_MS = 15 * 60_000;

type SignInUser = Prisma.UserGetPayload<{ include: typeof SIGN_IN_INCLUDE }>;

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: AuthTokenService,
    private readonly config: ConfigService,
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
        include: SIGN_IN_INCLUDE,
      }),
    );
    if (
      !user ||
      user.status !== "ACTIVE" ||
      // A vendor team login is unusable while its Main Vendor is suspended.
      (user.vendorOwnerId !== null && user.vendorOwner?.status !== "ACTIVE") ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      if (user) await this.recordFailedLogin(user, meta);
      throw new UnauthorizedException("Invalid workspace, email, or password");
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account is temporarily locked");
    }
    const maxAgeDays = Number(
      this.config.get<number>(
        "PASSWORD_MAX_AGE_DAYS",
        DEFAULT_PASSWORD_MAX_AGE_DAYS,
      ),
    );
    if (
      !user.mustChangePassword &&
      passwordExpired(user.passwordChangedAt, maxAgeDays)
    ) {
      // 90-day password policy: the existing change-password gate takes over.
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mustChangePassword: true },
      });
      await this.prisma.auditEvent.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "auth.password-expired",
          resourceType: "user",
          resourcePublicId: user.publicId,
          afterJson: JSON.stringify({
            passwordChangedAt: user.passwordChangedAt,
            maxAgeDays,
          }),
        },
      });
      return this.completeSignIn(
        { ...user, mustChangePassword: true },
        meta,
        true,
      );
    }

    return this.completeSignIn(user, meta);
  }

  /** Sign in a user whose identity was just proven another way (sign-up email OTP). */
  async signInVerifiedUser(userId: bigint, meta: RequestMeta) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: SIGN_IN_INCLUDE,
    });
    return this.completeSignIn(user, meta);
  }

  private async completeSignIn(
    user: SignInUser,
    meta: RequestMeta,
    passwordExpiredNow = false,
  ) {
    const policy = await this.prisma.tenantAccessPolicy.findUnique({
      where: { tenantId: user.tenantId },
      select: { branchScopingEnabled: true },
    });
    const branchScoping = policy?.branchScopingEnabled === true;
    const branch = branchScoping ? user.branch : null;
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
          branchPublicId: branch?.publicId,
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
        locationLabel: meta.locationLabel,
        afterJson: JSON.stringify({ userAgent: meta.userAgent?.slice(0, 300) }),
      },
    });
    const roles = [
      ...new Set(
        user.userRoles.map(({ role }) => role.baseRoleCode ?? role.code),
      ),
    ];
    return {
      tokens: tokenPair,
      session: {
        id: user.publicId,
        tenantId: user.tenant.publicId,
        tenantName: user.tenant.name,
        branchId: branch?.publicId,
        branchName: branch?.name,
        branchScoping,
        clientId: user.client?.publicId,
        clientName: user.client?.displayName,
        clientStatus: user.client?.status,
        ...(user.spocClientScopes.length
          ? {
              clientScope: user.spocClientScopes.map(({ client }) => ({
                id: client.publicId,
                name: client.displayName,
              })),
            }
          : {}),
        email: user.email,
        displayName: user.displayName,
        mustChangePassword: user.mustChangePassword,
        ...(passwordExpiredNow ? { passwordExpired: true } : {}),
        roles,
        permissions: this.viewOnly(roles)
          ? [...VIEW_ONLY_PERMISSIONS]
          : this.permissions(user.userRoles),
        viewOnly: this.viewOnly(roles),
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
      branchScoping: actor.branchScoping === true,
      clientId: actor.clientPublicId,
      clientName: actor.clientName,
      clientStatus: actor.clientStatus,
      ...(actor.spocClients
        ? {
            clientScope: actor.spocClients.map((client) => ({
              id: client.publicId,
              name: client.name,
            })),
          }
        : {}),
      ...(actor.departments
        ? {
            departments: actor.departments.map((department) => ({
              id: department.publicId,
              code: department.code,
              name: department.name,
              kind: department.kind,
              role: department.role,
            })),
          }
        : {}),
      email: actor.email,
      displayName: actor.displayName,
      mustChangePassword: actor.mustChangePassword,
      roles: actor.roles,
      // The UI hides writes for a view-only admin; the guard refuses them regardless.
      permissions: this.viewOnly(actor.roles)
        ? [...VIEW_ONLY_PERMISSIONS]
        : actor.permissions,
      viewOnly: this.viewOnly(actor.roles),
    };
  }

  private viewOnly(roles: readonly string[]) {
    return isViewOnlyAdmin(
      roles,
      this.config.get<boolean>("PLATFORM_ADMIN_VIEW_ONLY", true),
    );
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
          locationLabel: meta.locationLabel,
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

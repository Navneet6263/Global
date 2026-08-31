import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { assertAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import { PrismaService } from "../database/prisma.service";
import { hashPassword } from "../auth/password";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import type { UserDirectoryQueryDto } from "./dto/user-directory-query.dto";
import type { Prisma } from "../generated/prisma/client";

export function userDirectoryBranchScope(actor: Actor) {
  return !actor.roles.includes("PLATFORM_ADMIN") && actor.branchId
    ? { branchId: actor.branchId }
    : {};
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: UserDirectoryQueryDto) {
    this.assertDirectoryRole(actor);
    const where = userDirectoryWhere(actor, query);
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          publicId: true,
          displayName: true,
          email: true,
          phone: true,
          status: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
          version: true,
          branch: { select: { publicId: true, code: true, name: true } },
          client: { select: { publicId: true, displayName: true } },
          userRoles: {
            select: { role: { select: { code: true, name: true } } },
          },
        },
        orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: users.map(({ publicId, userRoles, ...user }) => ({
        id: publicId,
        ...user,
        roles: userRoles.map(({ role: assignedRole }) => assignedRole),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async roles(actor: Actor) {
    this.assertDirectoryRole(actor);
    const rows = await this.prisma.role.findMany({
      where: { tenantId: actor.tenantId },
      select: {
        publicId: true,
        code: true,
        name: true,
        permissionsJson: true,
        isSystem: true,
      },
      orderBy: { name: "asc" },
    });
    return {
      items: rows.map(({ publicId, permissionsJson, ...role }) => ({
        id: publicId,
        ...role,
        permissions: this.parsePermissions(permissionsJson),
      })),
    };
  }

  async create(actor: Actor, input: CreateUserDto) {
    this.assertDirectoryRole(actor);
    const normalizedEmail = input.email.trim().toLowerCase();
    const exists = await this.prisma.user.findFirst({
      where: { tenantId: actor.tenantId, normalizedEmail },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException("A user with this email already exists");
    const [roles, branch, client] = await Promise.all([
      this.prisma.role.findMany({
        where: {
          tenantId: actor.tenantId,
          code: { in: [...new Set(input.roleCodes)] },
        },
        select: { id: true, code: true },
      }),
      input.branchId
        ? this.prisma.branch.findFirst({
            where: {
              tenantId: actor.tenantId,
              publicId: input.branchId,
              isActive: true,
            },
            select: { id: true },
          })
        : null,
      input.clientId
        ? this.prisma.client.findFirst({
            where: {
              tenantId: actor.tenantId,
              publicId: input.clientId,
              status: "ACTIVE",
            },
            select: { id: true },
          })
        : null,
    ]);
    if (roles.length !== new Set(input.roleCodes).size)
      throw new NotFoundException("One or more roles were not found");
    if (input.branchId && !branch)
      throw new NotFoundException("Active branch not found");
    if (input.clientId && !client)
      throw new NotFoundException("Active client not found");
    if (input.roleCodes.includes("CLIENT_ADMIN") && !client)
      throw new ConflictException(
        "Client administrators must be assigned to a client",
      );
    const passwordHash = await hashPassword(input.temporaryPassword);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.user.create({
        data: {
          tenantId: actor.tenantId,
          branchId: branch?.id,
          clientId: client?.id,
          email: input.email.trim(),
          normalizedEmail,
          displayName: input.displayName.trim(),
          phone: input.phone?.trim(),
          passwordHash,
          mustChangePassword: true,
          userRoles: { create: roles.map((role) => ({ roleId: role.id })) },
        },
        select: {
          publicId: true,
          email: true,
          displayName: true,
          status: true,
          mustChangePassword: true,
          version: true,
          createdAt: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "user.created",
          resourceType: "user",
          resourcePublicId: row.publicId,
          afterJson: JSON.stringify({
            email: row.email,
            roles: roles.map((role) => role.code),
          }),
        },
      });
      const { publicId, ...user } = row;
      return { id: publicId, ...user, roles: roles.map((role) => role.code) };
    });
  }

  async update(actor: Actor, publicId: string, input: UpdateUserDto) {
    this.assertDirectoryRole(actor);
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        ...this.branchScope(actor),
      },
      select: {
        id: true,
        version: true,
        status: true,
        clientId: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.version !== input.version)
      throw new ConflictException("User changed; refresh and try again");
    if (publicId === actor.userPublicId && input.status === "SUSPENDED")
      throw new ForbiddenException("You cannot suspend your own account");
    const roles = input.roleCodes
      ? await this.prisma.role.findMany({
          where: {
            tenantId: actor.tenantId,
            code: { in: [...new Set(input.roleCodes)] },
          },
          select: { id: true, code: true },
        })
      : [];
    if (input.roleCodes && roles.length !== new Set(input.roleCodes).size)
      throw new NotFoundException("One or more roles were not found");
    const currentRoleCodes = user.userRoles.map(({ role }) => role.code);
    const nextRoleCodes = input.roleCodes ?? currentRoleCodes;
    if (nextRoleCodes.includes("CLIENT_ADMIN") && !user.clientId) {
      throw new ConflictException(
        "Client administrators must be assigned to a client",
      );
    }
    const mayRemovePlatformAdmin =
      user.status === "ACTIVE" &&
      currentRoleCodes.includes("PLATFORM_ADMIN") &&
      (input.status === "SUSPENDED" ||
        !nextRoleCodes.includes("PLATFORM_ADMIN"));
    return this.prisma.$transaction(
      async (tx) => {
        if (mayRemovePlatformAdmin) {
          const otherActiveAdministrators = await tx.user.count({
            where: {
              tenantId: actor.tenantId,
              id: { not: user.id },
              status: "ACTIVE",
              userRoles: { some: { role: { code: "PLATFORM_ADMIN" } } },
            },
          });
          if (!otherActiveAdministrators) {
            throw new ConflictException(
              "The tenant must retain at least one active platform administrator",
            );
          }
        }
        const updated = await tx.user.updateMany({
          where: { id: user.id, version: input.version },
          data: { status: input.status, version: { increment: 1 } },
        });
        if (updated.count !== 1)
          throw new ConflictException("User was updated concurrently");
        if (input.roleCodes) {
          await tx.userRole.deleteMany({ where: { userId: user.id } });
          await tx.userRole.createMany({
            data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
          });
        }
        if (input.status === "SUSPENDED")
          await tx.refreshSession.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "user.updated",
            resourceType: "user",
            resourcePublicId: publicId,
            afterJson: JSON.stringify({
              status: input.status ?? user.status,
              roles: nextRoleCodes,
              version: input.version + 1,
            }),
          },
        });
        return {
          id: publicId,
          status: input.status ?? user.status,
          roleCodes: nextRoleCodes,
          version: input.version + 1,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  async resetPassword(
    actor: Actor,
    publicId: string,
    temporaryPassword: string,
  ) {
    this.assertDirectoryRole(actor);
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        ...this.branchScope(actor),
      },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("User not found");
    const passwordHash = await hashPassword(temporaryPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: new Date(),
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
          action: "user.password.reset",
          resourceType: "user",
          resourcePublicId: publicId,
        },
      });
    });
    return { reset: true };
  }

  async activity(actor: Actor, publicId: string) {
    this.assertDirectoryRole(actor);
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        ...this.branchScope(actor),
      },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("User not found");
    const rows = await this.prisma.auditEvent.findMany({
      where: {
        tenantId: actor.tenantId,
        OR: [
          { resourceType: "user", resourcePublicId: publicId },
          { actorUserId: user.id, action: { startsWith: "auth." } },
        ],
      },
      select: {
        publicId: true,
        action: true,
        ipAddress: true,
        afterJson: true,
        createdAt: true,
        actor: { select: { displayName: true } },
      },
      orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
      take: 30,
    });
    return {
      items: rows.map(({ publicId: id, ...event }) => ({ id, ...event })),
    };
  }

  private parsePermissions(value: string): string[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  }

  private branchScope(actor: Actor) {
    return userDirectoryBranchScope(actor);
  }

  private assertDirectoryRole(actor: Actor) {
    assertAnyRole(
      actor,
      OPERATIONS_ROLES,
      "Only operations can access the tenant user directory",
    );
  }
}

export function userDirectoryWhere(
  actor: Actor,
  query: Pick<UserDirectoryQueryDto, "role" | "search" | "status">,
): Prisma.UserWhereInput {
  const search = query.search?.trim();
  return {
    tenantId: actor.tenantId,
    ...userDirectoryBranchScope(actor),
    ...(query.role
      ? { userRoles: { some: { role: { code: query.role } } } }
      : {}),
    ...(query.status === "INVITED"
      ? { status: "ACTIVE", mustChangePassword: true }
      : query.status === "ACTIVE"
        ? { status: "ACTIVE", mustChangePassword: false }
        : query.status === "SUSPENDED"
          ? { status: "SUSPENDED" }
          : {}),
    ...(search
      ? {
          OR: [
            { displayName: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { branch: { name: { contains: search } } },
            { client: { displayName: { contains: search } } },
          ],
        }
      : {}),
  };
}

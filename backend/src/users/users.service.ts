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
import { assertSafeRoleCombination } from "./role-combination";
import { assertCanCreateUser, userCreationPolicy } from "./ops-user-creation";
import {
  assertSpocClientInput,
  resolveScopeClients,
  type ScopeClient,
} from "./spoc-client-scope";
import { networkLocationLabel } from "../common/http/network-location";
import { applyVendorTeamRulesOnEdit } from "../vendor-requests/services/vendor-team-rules";
import {
  assertEmailAvailable,
  insertUserAccount,
  resetAccountPassword,
  resolveRoles,
  revokeSessions,
} from "./user-accounts";
import type { UserActivityQueryDto } from "./dto/user-activity-query.dto";

const toSpocClient = ({
  publicId,
  displayName,
}: {
  publicId: string;
  displayName: string;
}) => ({ id: publicId, displayName });

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
          vendorOwner: { select: { displayName: true } },
          userRoles: {
            select: { role: { select: { code: true, name: true } } },
          },
          spocClientScopes: {
            select: {
              client: { select: { publicId: true, displayName: true } },
            },
            orderBy: { client: { displayName: "asc" } },
          },
        },
        orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: users.map(
        ({ publicId, userRoles, spocClientScopes, vendorOwner, ...user }) => ({
          id: publicId,
          ...user,
          vendorTeamOf: vendorOwner?.displayName ?? null,
          roles: userRoles.map(({ role: assignedRole }) => assignedRole),
          spocClients: spocClientScopes.map(({ client }) =>
            toSpocClient(client),
          ),
        }),
      ),
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

  creationPolicy(actor: Actor) {
    this.assertDirectoryRole(actor);
    return userCreationPolicy(this.prisma, actor);
  }

  async create(actor: Actor, input: CreateUserDto) {
    this.assertDirectoryRole(actor);
    const createdVia = await assertCanCreateUser(this.prisma, actor, input);
    assertSafeRoleCombination(input.roleCodes, input.additionalAccessConfirmed);
    assertSpocClientInput(input.roleCodes, input);
    await assertEmailAvailable(this.prisma, actor.tenantId, input.email);
    const [roles, branch, client, scopeClients] = await Promise.all([
      resolveRoles(this.prisma, actor.tenantId, input.roleCodes),
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
      input.spocClientIds
        ? resolveScopeClients(this.prisma, actor.tenantId, input.spocClientIds)
        : ([] as ScopeClient[]),
    ]);
    if (input.branchId && !branch)
      throw new NotFoundException("Active branch not found");
    if (input.clientId && !client)
      throw new NotFoundException("Active client not found");
    if (input.roleCodes.includes("CLIENT_ADMIN") && !client)
      throw new ConflictException(
        "Client administrators must be assigned to a client",
      );
    if (input.roleCodes.includes("VENDOR") && input.clientId)
      throw new ConflictException(
        "Vendor accounts cannot be tied to a client workspace",
      );
    if (input.roleCodes.includes("SUPPORT_AGENT") && input.clientId)
      throw new ConflictException(
        "Support Agent accounts see every client and cannot be tied to one client workspace",
      );
    const passwordHash = await hashPassword(input.temporaryPassword);
    return this.prisma.$transaction(async (tx) => {
      const row = await insertUserAccount(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        email: input.email,
        displayName: input.displayName,
        phone: input.phone,
        passwordHash,
        roles,
        branchId: branch?.id,
        clientId: client?.id,
        spocClientIds: scopeClients.map((scope) => scope.id),
        audit: {
          ...(scopeClients.length
            ? { clients: scopeClients.map((scope) => scope.publicId) }
            : {}),
          ...(createdVia === "OPERATIONS" ? { createdVia } : {}),
        },
      });
      const { publicId, ...user } = row;
      return {
        id: publicId,
        ...user,
        roles: roles.map((role) => role.code),
        ...(scopeClients.length
          ? { spocClients: scopeClients.map(toSpocClient) }
          : {}),
      };
    });
  }

  async update(actor: Actor, publicId: string, input: UpdateUserDto) {
    assertAnyRole(
      actor,
      ["PLATFORM_ADMIN"],
      "Only platform administrators can change account access",
    );
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
        displayName: true,
        vendorOwnerId: true,
        userRoles: { select: { role: { select: { code: true } } } },
        spocClientScopes: {
          select: {
            client: {
              select: { id: true, publicId: true, displayName: true },
            },
          },
        },
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
    const rolesChanged =
      currentRoleCodes.length !== nextRoleCodes.length ||
      currentRoleCodes.some((role) => !nextRoleCodes.includes(role));
    if (input.roleCodes) {
      assertSafeRoleCombination(nextRoleCodes, input.additionalAccessConfirmed);
    }
    if (nextRoleCodes.includes("CLIENT_ADMIN") && !user.clientId) {
      throw new ConflictException(
        "Client administrators must be assigned to a client",
      );
    }
    // SPOC-RM client scope lives only in SpocClientScope (never User.clientId).
    const currentScope: ScopeClient[] = user.spocClientScopes.map(
      ({ client }) => client,
    );
    const nextIsSpoc = nextRoleCodes.includes("SPOC_RM");
    if (!nextIsSpoc && input.spocClientIds !== undefined)
      throw new ConflictException(
        "Only SPOC-RM users can be assigned multiple client workspaces",
      );
    const nextScope = !nextIsSpoc
      ? []
      : input.spocClientIds
        ? await resolveScopeClients(
            this.prisma,
            actor.tenantId,
            input.spocClientIds,
            currentScope.map((client) => client.id),
          )
        : currentScope;
    if (nextIsSpoc && !nextScope.length)
      throw new ConflictException(
        "SPOC-RM users must be assigned at least one client workspace",
      );
    const scopeChanged =
      nextScope.length !== currentScope.length ||
      nextScope.some(
        (client) => !currentScope.some((current) => current.id === client.id),
      );
    if (nextRoleCodes.includes("VENDOR") && user.clientId) {
      throw new ConflictException(
        "Vendor accounts cannot be tied to a client workspace",
      );
    }
    if (nextRoleCodes.includes("SUPPORT_AGENT") && user.clientId) {
      throw new ConflictException(
        "Support Agent accounts see every client and cannot be tied to one client workspace",
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
        const team = await applyVendorTeamRulesOnEdit(tx, {
          tenantId: actor.tenantId,
          user,
          wasVendor: currentRoleCodes.includes("VENDOR"),
          staysVendor: nextRoleCodes.includes("VENDOR"),
          nextStatus: input.status ?? user.status,
        });
        const updated = await tx.user.updateMany({
          where: { id: user.id, version: input.version },
          data: {
            status: input.status,
            version: { increment: 1 },
            ...(nextIsSpoc && user.clientId ? { clientId: null } : {}),
            ...(team.clearOwner ? { vendorOwnerId: null } : {}),
          },
        });
        if (updated.count !== 1)
          throw new ConflictException("User was updated concurrently");
        if (input.roleCodes) {
          await tx.userRole.deleteMany({ where: { userId: user.id } });
          await tx.userRole.createMany({
            data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
          });
        }
        // Replaced in the same transaction; the actor reloads it on every request,
        // so a removed client stops working on that user's next API call.
        if (scopeChanged) {
          await tx.spocClientScope.deleteMany({ where: { userId: user.id } });
          if (nextScope.length)
            await tx.spocClientScope.createMany({
              data: nextScope.map((client) => ({
                userId: user.id,
                clientId: client.id,
              })),
            });
        }
        if (input.status === "SUSPENDED" || rolesChanged)
          await revokeSessions(tx, user.id);
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "user.updated",
            resourceType: "user",
            resourcePublicId: publicId,
            beforeJson: JSON.stringify({
              status: user.status,
              roles: currentRoleCodes,
              version: user.version,
              ...(currentScope.length
                ? { clients: currentScope.map((client) => client.publicId) }
                : {}),
            }),
            afterJson: JSON.stringify({
              status: input.status ?? user.status,
              roles: nextRoleCodes,
              version: input.version + 1,
              ...(currentScope.length || nextScope.length
                ? { clients: nextScope.map((client) => client.publicId) }
                : {}),
            }),
          },
        });
        return {
          id: publicId,
          status: input.status ?? user.status,
          roleCodes: nextRoleCodes,
          version: input.version + 1,
          ...(nextIsSpoc ? { spocClients: nextScope.map(toSpocClient) } : {}),
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
    await this.prisma.$transaction((tx) =>
      resetAccountPassword(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        userId: user.id,
        publicId,
        passwordHash,
      }),
    );
    return { reset: true };
  }

  async activity(actor: Actor, publicId: string, query: UserActivityQueryDto) {
    this.assertDirectoryRole(actor);
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        ...this.branchScope(actor),
      },
      select: { id: true, displayName: true, email: true },
    });
    if (!user) throw new NotFoundException("User not found");
    const where = {
      tenantId: actor.tenantId,
      OR: [
        { actorUserId: user.id },
        { resourceType: "user", resourcePublicId: publicId },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        select: {
          publicId: true,
          action: true,
          resourceType: true,
          resourcePublicId: true,
          requestId: true,
          ipAddress: true,
          locationLabel: true,
          beforeJson: true,
          afterJson: true,
          createdAt: true,
          actor: { select: { displayName: true, email: true } },
        },
        orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return {
      user: { id: publicId, displayName: user.displayName, email: user.email },
      items: rows.map(({ publicId: id, ...event }) => ({
        id,
        ...event,
        locationLabel: networkLocationLabel(
          event.ipAddress,
          event.locationLabel,
        ),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
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
            {
              spocClientScopes: {
                some: { client: { displayName: { contains: search } } },
              },
            },
          ],
        }
      : {}),
  };
}

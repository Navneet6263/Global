import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { CUSTOM_ROLE_BASES, customRoleCode } from "./custom-role-rules";

export {
  CUSTOM_ROLE_BASES,
  customRoleCode,
  type CustomRoleBase,
} from "./custom-role-rules";

const parse = (json: string): string[] => {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

/**
 * Custom roles (BGV process: create / edit / delete roles): a named variant of a system
 * role with a narrower permission set. Users with it work as the base role, limited to
 * the chosen permissions. System roles are never changed. Every change is audited.
 */
@Injectable()
export class CustomRolesService {
  constructor(private readonly prisma: PrismaService) {}

  private async base(tenantId: bigint, code: string) {
    const base = await this.prisma.role.findFirst({
      where: { tenantId, code, isSystem: true },
      select: { code: true, name: true, permissionsJson: true },
    });
    if (!base) throw new NotFoundException("Base role not found");
    return { ...base, permissions: parse(base.permissionsJson) };
  }

  private narrow(allowed: readonly string[], requested: readonly string[]) {
    const unique = [...new Set(requested)];
    const outside = unique.filter(
      (permission) => !allowed.includes(permission),
    );
    if (outside.length)
      throw new BadRequestException(
        `A custom role cannot add permissions its base role does not have: ${outside.join(", ")}`,
      );
    if (!unique.length)
      throw new BadRequestException("Keep at least one permission");
    return unique.sort();
  }

  async list(actor: Actor) {
    const rows = await this.prisma.role.findMany({
      where: {
        tenantId: actor.tenantId,
        OR: [{ isSystem: false }, { code: { in: [...CUSTOM_ROLE_BASES] } }],
      },
      orderBy: { name: "asc" },
      select: {
        publicId: true,
        code: true,
        name: true,
        isSystem: true,
        baseRoleCode: true,
        permissionsJson: true,
        updatedAt: true,
        _count: { select: { userRoles: true } },
      },
    });
    return {
      bases: rows
        .filter((row) => row.isSystem)
        .map((row) => ({
          code: row.code,
          name: row.name,
          permissions: parse(row.permissionsJson),
        })),
      items: rows
        .filter((row) => !row.isSystem)
        .map((row) => ({
          id: row.publicId,
          code: row.code,
          name: row.name,
          baseRoleCode: row.baseRoleCode,
          permissions: parse(row.permissionsJson),
          users: row._count.userRoles,
          updatedAt: row.updatedAt,
        })),
    };
  }

  async create(
    actor: Actor,
    input: { name: string; baseRoleCode: string; permissions: string[] },
  ) {
    if (!(CUSTOM_ROLE_BASES as readonly string[]).includes(input.baseRoleCode))
      throw new BadRequestException("Choose a supported base role");
    const name = input.name.trim();
    const code = customRoleCode(name);
    const base = await this.base(actor.tenantId, input.baseRoleCode);
    const permissions = this.narrow(base.permissions, input.permissions);
    const exists = await this.prisma.role.findFirst({
      where: { tenantId: actor.tenantId, OR: [{ code }, { name }] },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException("A role with this name already exists");
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId: actor.tenantId,
          code,
          name,
          baseRoleCode: base.code,
          permissionsJson: JSON.stringify(permissions),
          isSystem: false,
        },
        select: { publicId: true, code: true },
      });
      await this.audit(tx, actor, role.publicId, "role.custom-created", {
        code,
        name,
        baseRoleCode: base.code,
        permissions,
      });
      return { id: role.publicId, code: role.code };
    });
  }

  async update(
    actor: Actor,
    roleId: string,
    input: { name?: string; permissions?: string[] },
  ) {
    const role = await this.custom(actor, roleId);
    const base = await this.base(actor.tenantId, role.baseRoleCode!);
    const permissions = input.permissions
      ? this.narrow(base.permissions, input.permissions)
      : parse(role.permissionsJson);
    const name = input.name?.trim() || role.name;
    if (name !== role.name) {
      const taken = await this.prisma.role.findFirst({
        where: { tenantId: actor.tenantId, name, id: { not: role.id } },
        select: { id: true },
      });
      if (taken)
        throw new ConflictException("A role with this name already exists");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: role.id },
        data: { name, permissionsJson: JSON.stringify(permissions) },
      });
      await this.audit(
        tx,
        actor,
        roleId,
        "role.custom-updated",
        { name, permissions },
        { name: role.name, permissions: parse(role.permissionsJson) },
      );
    });
    // Signed-in users pick up the new permissions on their next request.
    return { id: roleId, name, permissions };
  }

  async remove(actor: Actor, roleId: string) {
    const role = await this.custom(actor, roleId);
    const assigned = await this.prisma.userRole.count({
      where: { roleId: role.id },
    });
    if (assigned)
      throw new ConflictException(
        `${assigned} user${assigned === 1 ? " has" : "s have"} this role. Move them to another role first.`,
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id: role.id } });
      await this.audit(tx, actor, roleId, "role.custom-deleted", {
        code: role.code,
        name: role.name,
      });
    });
    return { id: roleId, deleted: true };
  }

  /** Users who can take this role: those holding only its base role or a sibling. */
  async members(actor: Actor, roleId: string) {
    const role = await this.custom(actor, roleId);
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: actor.tenantId,
        status: "ACTIVE",
        userRoles: {
          some: {
            role: {
              OR: [
                { code: role.baseRoleCode! },
                { baseRoleCode: role.baseRoleCode },
              ],
            },
          },
        },
      },
      orderBy: { displayName: "asc" },
      take: 200,
      select: {
        publicId: true,
        displayName: true,
        email: true,
        userRoles: { select: { role: { select: { id: true } } } },
      },
    });
    return {
      items: users
        .filter((user) => user.userRoles.length === 1)
        .map((user) => ({
          id: user.publicId,
          displayName: user.displayName,
          email: user.email,
          assigned: user.userRoles[0]!.role.id === role.id,
        })),
    };
  }

  /**
   * Gives a user the custom role in place of its base role (or back, with
   * `assigned: false`). Only single-role users of the same base can switch.
   */
  async assign(
    actor: Actor,
    roleId: string,
    userId: string,
    assigned: boolean,
  ) {
    const role = await this.custom(actor, roleId);
    const base = await this.prisma.role.findFirst({
      where: {
        tenantId: actor.tenantId,
        code: role.baseRoleCode!,
        isSystem: true,
      },
      select: { id: true },
    });
    if (!base) throw new NotFoundException("Base role not found");
    const user = await this.prisma.user.findFirst({
      where: { tenantId: actor.tenantId, publicId: userId },
      select: {
        id: true,
        userRoles: {
          select: {
            roleId: true,
            role: { select: { code: true, baseRoleCode: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    const current = user.userRoles[0];
    if (
      user.userRoles.length !== 1 ||
      !current ||
      (current.role.baseRoleCode ?? current.role.code) !== role.baseRoleCode
    )
      throw new ConflictException(
        "Only a user with just this role's base role can switch to it",
      );
    const target = assigned ? role.id : base.id;
    if (current.roleId === target) return { userId, assigned };
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: user.id } });
      await tx.userRole.create({ data: { userId: user.id, roleId: target } });
      await tx.user.update({
        where: { id: user.id },
        data: { version: { increment: 1 } },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: assigned ? "role.custom-assigned" : "role.custom-unassigned",
          resourceType: "user",
          resourcePublicId: userId,
          beforeJson: JSON.stringify({ role: current.role.code }),
          afterJson: JSON.stringify({
            role: assigned ? role.code : role.baseRoleCode,
          }),
        },
      });
    });
    return { userId, assigned };
  }

  private async custom(actor: Actor, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { tenantId: actor.tenantId, publicId: roleId },
      select: {
        id: true,
        code: true,
        name: true,
        isSystem: true,
        baseRoleCode: true,
        permissionsJson: true,
      },
    });
    if (!role) throw new NotFoundException("Role not found");
    if (role.isSystem || !role.baseRoleCode)
      throw new ConflictException("System roles cannot be changed");
    return role;
  }

  private audit(
    tx: Prisma.TransactionClient,
    actor: Actor,
    roleId: string,
    action: string,
    after: Record<string, unknown>,
    before?: Record<string, unknown>,
  ) {
    return tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action,
        resourceType: "role",
        resourcePublicId: roleId,
        ...(before ? { beforeJson: JSON.stringify(before) } : {}),
        afterJson: JSON.stringify(after),
      },
    });
  }
}

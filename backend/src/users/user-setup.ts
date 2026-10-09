import { BadRequestException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Prisma } from "../generated/prisma/client";
import { CUSTOM_ROLE_BASES, customRoleCode } from "./custom-role-rules";

type Tx = Prisma.TransactionClient;

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
 * "Customise access" while creating a user: for each role whose ticks were narrowed, a
 * personal role ("Data Entry · Rahul") is created on that base and used instead. The
 * person never gains a permission the base role does not have. Returns the roles to give.
 */
export async function personalRoles(
  tx: Tx,
  input: {
    tenantId: bigint;
    actorUserId: bigint;
    displayName: string;
    roles: ReadonlyArray<{ id: bigint; code: string }>;
    access?: ReadonlyArray<{ role: string; permissions: string[] }>;
  },
) {
  if (!input.access?.length) return { roles: [...input.roles], created: [] };
  const roles = [...input.roles];
  const created: string[] = [];
  for (const choice of input.access) {
    if (!(CUSTOM_ROLE_BASES as readonly string[]).includes(choice.role))
      throw new BadRequestException(
        "Access can be customised for Data Entry, Verifier, QC, Finance and Field roles",
      );
    const index = roles.findIndex((role) => role.code === choice.role);
    if (index < 0)
      throw new BadRequestException("Customise only a role you are giving");
    const base = await tx.role.findFirst({
      where: { tenantId: input.tenantId, code: choice.role, isSystem: true },
      select: { name: true, permissionsJson: true },
    });
    if (!base) throw new BadRequestException("Base role not found");
    const allowed = parse(base.permissionsJson);
    const picked = [...new Set(choice.permissions)].sort();
    const outside = picked.filter(
      (permission) => !allowed.includes(permission),
    );
    if (outside.length)
      throw new BadRequestException(
        `Access cannot go beyond the ${base.name} role: ${outside.join(", ")}`,
      );
    if (!picked.length)
      throw new BadRequestException(
        `Keep at least one ${base.name} permission`,
      );
    // Same as the full role: nothing to customise.
    if (picked.length === allowed.length) continue;
    const name = `${base.name} · ${input.displayName.trim()}`.slice(0, 100);
    const code = `${customRoleCode(name).slice(0, 40)}_${randomBytes(2).toString("hex").toUpperCase()}`;
    const role = await tx.role.create({
      data: {
        tenantId: input.tenantId,
        code,
        name,
        baseRoleCode: choice.role,
        permissionsJson: JSON.stringify(picked),
        isSystem: false,
      },
      select: { id: true, code: true, publicId: true },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "role.custom-created",
        resourceType: "role",
        resourcePublicId: role.publicId,
        afterJson: JSON.stringify({
          code,
          name,
          baseRoleCode: choice.role,
          permissions: picked,
          personal: true,
        }),
      },
    });
    roles[index] = { id: role.id, code: role.code };
    created.push(code);
  }
  return { roles, created };
}

const MEMBER_ROLE: Readonly<Record<string, string>> = {
  DATA_ENTRY: "DATA_ENTRY",
  VERIFICATION: "VERIFIER",
};

/** Puts the new person in their teams (optionally as Team Leader), audited per team. */
export async function joinDepartments(
  tx: Tx,
  input: {
    tenantId: bigint;
    actorUserId: bigint;
    user: { id: bigint; publicId: string; displayName: string };
    roleCodes: readonly string[];
    departments?: ReadonlyArray<{ id: string; lead?: boolean }>;
  },
) {
  if (!input.departments?.length) return [];
  const rows = await tx.department.findMany({
    where: {
      tenantId: input.tenantId,
      status: "ACTIVE",
      publicId: { in: input.departments.map((department) => department.id) },
    },
    select: { id: true, publicId: true, name: true, kind: true },
  });
  if (rows.length !== new Set(input.departments.map((entry) => entry.id)).size)
    throw new BadRequestException("Choose active teams");
  const joined: string[] = [];
  for (const department of rows) {
    const needs = MEMBER_ROLE[department.kind];
    if (needs && !input.roleCodes.includes(needs))
      throw new BadRequestException(
        `${department.name} is a ${needs === "DATA_ENTRY" ? "Data Entry" : "verification"} team: give the ${needs === "DATA_ENTRY" ? "Data Entry" : "Verifier"} role too`,
      );
    const lead = Boolean(
      input.departments.find((entry) => entry.id === department.publicId)?.lead,
    );
    await tx.departmentMember.create({
      data: {
        departmentId: department.id,
        userId: input.user.id,
        role: lead ? "LEAD" : "MEMBER",
      },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "department.member-added",
        resourceType: "department",
        resourcePublicId: department.publicId,
        afterJson: JSON.stringify({
          userId: input.user.publicId,
          userName: input.user.displayName,
          role: lead ? "LEAD" : "MEMBER",
          department: department.name,
        }),
      },
    });
    joined.push(department.name);
  }
  return joined;
}

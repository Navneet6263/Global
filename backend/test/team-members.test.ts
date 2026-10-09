import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { TeamMembersService } from "../src/workflow/team-members.service";

const UUID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const lead = {
  tenantId: 1n,
  userId: 10n,
  userPublicId: UUID(10),
  roles: ["VERIFIER"],
  permissions: ["task:read"],
  departments: [
    {
      id: 7n,
      kind: "VERIFICATION",
      role: "LEAD",
      name: "Employment",
      code: "EMP",
    },
  ],
} as unknown as Actor;
const team = {
  id: 7n,
  publicId: UUID(7),
  name: "Employment",
  kind: "VERIFICATION",
};

function fake(user?: Record<string, unknown>) {
  const audits: Array<{ action: string; afterJson?: string }> = [];
  const created: Array<Record<string, unknown>> = [];
  const members: Array<Record<string, unknown>> = [];
  const tx = {
    user: {
      findFirst: () => null,
      create: (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return {
          publicId: UUID(50),
          email: "new@example.invalid",
          displayName: "Asha",
          status: "ACTIVE",
          mustChangePassword: true,
          version: 1,
          createdAt: new Date(),
        };
      },
      findUniqueOrThrow: () => ({ id: 50n }),
      updateMany: () => ({ count: 1 }),
      update: () => ({}),
    },
    role: {
      findMany: () => [{ id: 3n, code: "VERIFIER" }],
      findFirst: () => ({
        name: "Verifier",
        permissionsJson: JSON.stringify([
          "task:read",
          "task:write",
          "case:read",
        ]),
      }),
      create: (args: { data: { code: string } }) => ({
        id: 99n,
        code: args.data.code,
        publicId: UUID(99),
      }),
    },
    department: { findMany: () => [team] },
    departmentMember: {
      create: (args: { data: Record<string, unknown> }) =>
        members.push(args.data),
    },
    auditEvent: {
      create: (args: { data: { action: string; afterJson?: string } }) =>
        audits.push(args.data),
    },
    refreshSession: { updateMany: () => ({ count: 1 }) },
    checkTask: { count: () => 2 },
  };
  const prisma = {
    ...tx,
    user: { ...tx.user, findFirst: () => user ?? null },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  return { service: new TeamMembersService(prisma), audits, created, members };
}

const input = {
  displayName: "Asha",
  email: "new@example.invalid",
  temporaryPassword: "Temp-Pass-2026!",
  departmentId: UUID(7),
};

void test("a Team Leader creates a Verifier ID in its own team, joined and audited", async () => {
  const { service, audits, created, members } = fake();
  const result = await service.create(lead, input);
  assert.deepEqual(result.roles, ["VERIFIER"]);
  assert.equal(result.team.name, "Employment");
  assert.equal(created[0]?.mustChangePassword, true);
  assert.deepEqual(members[0], {
    departmentId: 7n,
    userId: 50n,
    role: "MEMBER",
  });
  const made = audits.find((a) => a.action === "user.created");
  assert.equal(JSON.parse(made!.afterJson!).createdVia, "TEAM_LEADER");
  assert.ok(audits.some((a) => a.action === "department.member-added"));
});

void test("narrowed access becomes a personal role; nothing beyond the Verifier role", async () => {
  const { service, audits } = fake();
  const result = await service.create(lead, {
    ...input,
    permissions: ["task:read", "case:read"],
  });
  assert.equal(result.customAccess, true);
  assert.ok(audits.some((a) => a.action === "role.custom-created"));
  await assert.rejects(
    fake().service.create(lead, { ...input, permissions: ["user:write"] }),
    /beyond the Verifier role/,
  );
});

void test("only Team Leaders, and only into a team they lead", async () => {
  const member = {
    ...lead,
    departments: [{ ...lead.departments![0]!, role: "MEMBER" }],
  } as Actor;
  await assert.rejects(
    fake().service.create(member, input),
    ForbiddenException,
  );
  await assert.rejects(
    fake().service.create(lead, { ...input, departmentId: UUID(8) }),
    /team you lead/,
  );
});

const person = (overrides: Record<string, unknown> = {}) => ({
  id: 60n,
  publicId: UUID(60),
  displayName: "Priya",
  status: "ACTIVE",
  version: 2,
  userRoles: [{ role: { code: "VERIFIER", baseRoleCode: null } }],
  departmentMemberships: [{ role: "MEMBER", departmentId: 7n }],
  ...overrides,
});

void test("suspending a member ends sessions, reports open work and is audited", async () => {
  const { service, audits } = fake(person());
  const result = await service.setStatus(lead, UUID(60), {
    status: "SUSPENDED",
    version: 2,
  });
  assert.equal(result.openWork, 2);
  assert.equal(JSON.parse(audits[0]!.afterJson!).via, "TEAM_LEADER");
  await assert.rejects(
    fake(person()).service.setStatus(lead, UUID(60), {
      status: "SUSPENDED",
      version: 1,
    }),
    /refresh/,
  );
});

void test("leads, people with other roles and the TL itself cannot be changed here", async () => {
  for (const other of [
    person({ departmentMemberships: [{ role: "LEAD", departmentId: 7n }] }),
    person({
      userRoles: [
        { role: { code: "VERIFIER", baseRoleCode: null } },
        { role: { code: "OPS_MANAGER", baseRoleCode: null } },
      ],
    }),
    person({ id: 10n }),
  ])
    await assert.rejects(
      fake(other).service.resetPassword(lead, UUID(60), "Temp-Pass-2026!"),
      /plain team members/,
    );
  await assert.rejects(
    fake(person({ departmentMemberships: [] })).service.resetPassword(
      lead,
      UUID(60),
      "Temp-Pass-2026!",
    ),
    /not found/,
  );
});

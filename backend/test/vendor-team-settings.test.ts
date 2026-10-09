import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { rolePermissions } from "../prisma/seed-roles";
import { JwtStrategy } from "../src/auth/jwt.strategy";
import type { PrismaService } from "../src/database/prisma.service";
import { UpdateVendorTeamLimitDto } from "../src/settings/dto/update-vendor-team-limit.dto";
import { SettingsController } from "../src/settings/settings.controller";
import { VendorTeamPolicyService } from "../src/settings/vendor-team-policy.service";
import { passesGuard } from "./helpers/guard-check";
import { bigJson, testActor } from "./helpers/test-actor";
import { mainVendor } from "./helpers/vendor-team-fixtures";

const admin = testActor(["PLATFORM_ADMIN"], ["*"]);
const VENDOR_ID = "99999999-9999-4999-8999-999999999999";

function policyPrisma(
  options: { vendor?: unknown; active?: number; updated?: number } = {},
) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const record =
    (name: string, result: unknown) =>
    (args: Record<string, unknown> = {}) => {
      calls.push({ name, args });
      return Promise.resolve(result);
    };
  const tx = {
    user: {
      findFirst: record(
        "vendor",
        options.vendor === undefined
          ? {
              id: 31n,
              publicId: VENDOR_ID,
              displayName: "XYZ",
              vendorTeamPolicy: null,
            }
          : options.vendor,
      ),
      updateMany: record("lock", { count: 1 }),
      count: record("count", options.active ?? 0),
    },
    vendorTeamPolicy: {
      create: record("create", {
        publicId: "p-1",
        maxActiveUsers: 2,
        version: 1,
      }),
      updateMany: record("update", { count: options.updated ?? 1 }),
      findUniqueOrThrow: record("reload", {
        publicId: "p-1",
        maxActiveUsers: 3,
        version: 5,
      }),
    },
    auditEvent: { create: record("audit", {}) },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    user: {
      findMany: record("list", [
        {
          id: 31n,
          publicId: VENDOR_ID,
          displayName: "XYZ",
          email: "x@y",
          status: "ACTIVE",
          vendorTeamPolicy: { maxActiveUsers: 2, version: 4 },
        },
        {
          id: 32n,
          publicId: "abc",
          displayName: "ABC",
          email: "a@b",
          status: "ACTIVE",
          vendorTeamPolicy: null,
        },
      ]),
      groupBy: record("teams", [
        { vendorOwnerId: 31n, status: "ACTIVE", _count: { _all: 2 } },
        { vendorOwnerId: 31n, status: "SUSPENDED", _count: { _all: 1 } },
      ]),
    },
  } as unknown as PrismaService;
  return {
    service: new VendorTeamPolicyService(prisma),
    calls,
    names: () => calls.map((c) => c.name),
  };
}

void test("only Platform Admin reads and sets vendor team limits", () => {
  for (const method of ["vendorTeamLimits", "updateVendorTeamLimit"]) {
    assert.ok(
      passesGuard(SettingsController, method, admin, {
        platformAdminViewOnly: false,
      }),
      method,
    );
    // Settings stay with the Platform Admin even in view-only oversight.
    assert.ok(
      passesGuard(SettingsController, method, admin),
      `view-only admin ${method}`,
    );
    for (const who of [
      mainVendor,
      testActor(["OPS_MANAGER"], ["*"]),
      testActor(["SPOC_RM"], ["*"]),
    ])
      assert.ok(
        !passesGuard(SettingsController, method, who),
        `${who.roles[0]} ${method}`,
      );
  }
});

void test("the list shows Main Vendors only, with ACTIVE and inactive team counts", async () => {
  const { service, calls } = policyPrisma();
  const result = await service.list(admin);
  assert.match(
    bigJson(calls[0]!.args.where),
    /"vendorOwnerId":null.*"code":"VENDOR"/,
  );
  assert.deepEqual(
    result.items.map((item) => [
      item.name,
      item.limit,
      item.version,
      item.activeTeamUsers,
      item.inactiveTeamUsers,
    ]),
    [
      ["XYZ", 2, 4, 2, 1],
      ["ABC", 0, 0, 0, 0],
    ],
  );
  assert.equal(result.maxLimit, 50);
});

void test("setting a limit is versioned, audited and never below the ACTIVE team count", async () => {
  const fresh = policyPrisma({ active: 1 });
  const created = await fresh.service.update(admin, VENDOR_ID, {
    maxActiveUsers: 2,
    version: 0,
  });
  assert.equal(created.limit, 2);
  assert.deepEqual(fresh.names(), [
    "vendor",
    "lock",
    "count",
    "create",
    "audit",
  ]);
  const audit = fresh.calls[4]!.args.data as Record<string, unknown>;
  assert.equal(audit.action, "settings.vendor-team-limit.updated");

  const existing = {
    id: 31n,
    publicId: VENDOR_ID,
    displayName: "XYZ",
    vendorTeamPolicy: {
      id: 5n,
      publicId: "p-1",
      maxActiveUsers: 2,
      version: 4,
    },
  };
  const raised = policyPrisma({ vendor: existing, active: 2 });
  assert.equal(
    (
      await raised.service.update(admin, VENDOR_ID, {
        maxActiveUsers: 3,
        version: 4,
      })
    ).limit,
    3,
  );
  assert.deepEqual(raised.calls.find((c) => c.name === "update")!.args.where, {
    id: 5n,
    version: 4,
  });

  await assert.rejects(
    policyPrisma({ vendor: existing, active: 3 }).service.update(
      admin,
      VENDOR_ID,
      { maxActiveUsers: 2, version: 4 },
    ),
    /has 3 active team users/,
  );
  await assert.rejects(
    policyPrisma({ vendor: existing }).service.update(admin, VENDOR_ID, {
      maxActiveUsers: 2,
      version: 3,
    }),
    ConflictException,
  );
  await assert.rejects(
    policyPrisma({ vendor: null }).service.update(admin, VENDOR_ID, {
      maxActiveUsers: 1,
      version: 0,
    }),
    NotFoundException,
  );
  const range = (value: number) =>
    validateSync(
      plainToInstance(UpdateVendorTeamLimitDto, {
        maxActiveUsers: value,
        version: 0,
      }),
    ).length;
  assert.equal(range(0), 0);
  assert.equal(range(50), 0);
  assert.equal(range(51), 1);
  assert.equal(range(-1), 1);
});

void test("the migration and seed leave the VENDOR permissions exactly as they were", () => {
  const sql = readFileSync(
    join(
      __dirname,
      "../prisma/migrations/20261001100000_vendor_teams/migration.sql",
    ),
    "utf8",
  );
  assert.doesNotMatch(sql, /\[dbo\]\.\[Role\]/);
  assert.match(sql, /ADD \[vendorOwnerId\] BIGINT/);
  assert.match(sql, /CREATE TABLE \[dbo\]\.\[VendorTeamPolicy\]/);
  assert.deepEqual(rolePermissions.VENDOR, [
    "vendor:review",
    "notification:read",
  ]);
});

void test("a team login needs an active Main Vendor on every request", async () => {
  let sql = "";
  const strategy = new JwtStrategy(
    { getOrThrow: () => "secret" } as unknown as ConfigService,
    {
      $queryRaw: (strings: TemplateStringsArray) => {
        sql = strings.join("?");
        return Promise.resolve([
          {
            userId: 41n,
            userPublicId: "u-41",
            tenantId: 7n,
            tenantPublicId: "t-7",
            tenantName: "Sapling",
            branchId: null,
            branchPublicId: null,
            branchName: null,
            clientId: null,
            clientPublicId: null,
            clientName: null,
            email: "r@x",
            displayName: "Ravi",
            mustChangePassword: false,
            vendorOwnerId: 31n,
            roleCode: "VENDOR",
            permissionsJson: '["vendor:review"]',
          },
        ]);
      },
    } as unknown as PrismaService,
  );
  const actor = await strategy.validate({
    type: "access",
    sub: "u-41",
    tenantId: "t-7",
    email: "r@x",
    sessionId: "s-1",
  });
  assert.equal(actor.vendorOwnerId, 31n);
  assert.match(
    sql,
    /u\.\[vendorOwnerId\] IS NULL OR vendorOwner\.\[status\] = 'ACTIVE'/,
  );
});

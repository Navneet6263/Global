import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../src/database/prisma.service";
import { UsersService } from "../src/users/users.service";
import { testActor } from "./helpers/test-actor";
import {
  ALL_INTERNAL_ROLE_RULES,
  STANDARD_ROLE_RULES,
  assertSafeRoleCombination,
  roleRules,
} from "../src/users/role-combination";

const EVERY_INTERNAL_ROLE = [
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "SPOC_RM",
  "DATA_ENTRY",
  "VERIFIER",
  "QA_REVIEWER",
  "FINANCE_MANAGER",
  "SALES_MANAGER",
  "SUPPORT_AGENT",
  "FIELD_EXECUTIVE",
];

void test("the setting picks the rule; off is the normal 3-role rule", () => {
  assert.equal(roleRules(false), STANDARD_ROLE_RULES);
  assert.equal(roleRules(true), ALL_INTERNAL_ROLE_RULES);
  assert.equal(STANDARD_ROLE_RULES.maxRoles, 3);
});

void test("normal rule: at most 3 roles, and Admin / Ops / Support stay single", () => {
  assert.doesNotThrow(() =>
    assertSafeRoleCombination(["SPOC_RM", "DATA_ENTRY", "VERIFIER"], true),
  );
  assert.throws(
    () =>
      assertSafeRoleCombination(
        ["SPOC_RM", "DATA_ENTRY", "VERIFIER", "QA_REVIEWER"],
        true,
      ),
    /at most 3 roles/,
  );
  for (const single of ["PLATFORM_ADMIN", "OPS_MANAGER", "SUPPORT_AGENT"])
    assert.throws(
      () => assertSafeRoleCombination([single, "SALES_MANAGER"], true),
      ConflictException,
    );
});

void test("test mode: one person may hold every internal role", () => {
  assert.doesNotThrow(() =>
    assertSafeRoleCombination(EVERY_INTERNAL_ROLE, true, ALL_INTERNAL_ROLE_RULES),
  );
  assert.doesNotThrow(() =>
    assertSafeRoleCombination(
      ["PLATFORM_ADMIN", "OPS_MANAGER", "SALES_MANAGER"],
      true,
      ALL_INTERNAL_ROLE_RULES,
    ),
  );
});

void test("test mode still keeps Client Admin and Vendor single, and needs confirmation", () => {
  for (const outside of ["CLIENT_ADMIN", "VENDOR"])
    assert.throws(
      () =>
        assertSafeRoleCombination(
          [outside, "OPS_MANAGER"],
          true,
          ALL_INTERNAL_ROLE_RULES,
        ),
      ConflictException,
    );
  assert.throws(
    () =>
      assertSafeRoleCombination(
        ["OPS_MANAGER", "SALES_MANAGER"],
        false,
        ALL_INTERNAL_ROLE_RULES,
      ),
    /explicitly confirmed/,
  );
});

function service(allowAll?: boolean) {
  const prisma = {
    department: { findMany: () => Promise.resolve([]) },
    role: { findMany: () => Promise.resolve([]) },
  } as unknown as PrismaService;
  const config =
    allowAll === undefined
      ? undefined
      : ({ get: () => allowAll } as unknown as ConfigService);
  return new UsersService(prisma, config);
}

void test("setup options tell the screens which rule is on", async () => {
  const admin = testActor(["PLATFORM_ADMIN"], ["*"]);
  const off = (await service(false).setupOptions(admin)) as {
    roleRules: unknown;
  };
  const on = (await service(true).setupOptions(admin)) as {
    roleRules: unknown;
  };
  const missing = (await service().setupOptions(admin)) as {
    roleRules: unknown;
  };
  assert.deepEqual(off.roleRules, STANDARD_ROLE_RULES);
  assert.deepEqual(on.roleRules, ALL_INTERNAL_ROLE_RULES);
  // No config (older wiring / tests): the normal rule.
  assert.deepEqual(missing.roleRules, STANDARD_ROLE_RULES);
});

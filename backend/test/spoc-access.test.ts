import "reflect-metadata";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import {
  ConflictException,
  ForbiddenException,
  RequestMethod,
  type ExecutionContext,
} from "@nestjs/common";
import { METHOD_METADATA } from "@nestjs/common/constants";
import type { Reflector } from "@nestjs/core";
import type { Actor } from "../src/common/auth/actor";
import { PERMISSIONS_KEY, ROLES_KEY } from "../src/common/auth/auth.decorators";
import { PermissionsGuard } from "../src/common/auth/permissions.guard";
import { CaseStatuses } from "../src/cases/case.constants";
import { SpocController } from "../src/spoc/spoc.controller";
import { currentOwner } from "../src/spoc/spoc-case-records.service";
import { holderOf, statusesHeldBy } from "../src/spoc/spoc-holder";
import { assertSafeRoleCombination } from "../src/users/role-combination";

function actor(roles: string[], extra: Partial<Actor> = {}): Actor {
  return {
    userId: 11n,
    userPublicId: "00000000-0000-4000-8000-000000000011",
    tenantId: 7n,
    tenantPublicId: "00000000-0000-4000-8000-000000000007",
    tenantName: "Sapling Global",
    email: "spoc@sapling.example",
    displayName: "SPOC",
    mustChangePassword: false,
    roles,
    permissions: ["dashboard:read", "notification:read"],
    ...extra,
  };
}

function guardFor(user: Actor) {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === ROLES_KEY
        ? Reflect.getMetadata(ROLES_KEY, SpocController)
        : key === PERMISSIONS_KEY
          ? Reflect.getMetadata(PERMISSIONS_KEY, SpocController)
          : undefined,
  } as unknown as Reflector;
  const context = {
    getHandler: () => context,
    getClass: () => SpocController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return () => new PermissionsGuard(reflector).canActivate(context);
}

void test("/spoc is limited to SPOC_RM and PLATFORM_ADMIN with dashboard:read", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, SpocController), [
    "PLATFORM_ADMIN",
    "SPOC_RM",
  ]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, SpocController), [
    "dashboard:read",
  ]);
  assert.equal(guardFor(actor(["SPOC_RM"]))(), true);
  for (const role of [
    "OPS_MANAGER",
    "VERIFIER",
    "CLIENT_ADMIN",
    "FINANCE_MANAGER",
  ]) {
    assert.throws(
      guardFor(actor([role], { permissions: ["*"] })),
      ForbiddenException,
    );
  }
});

void test("every /spoc handler is a read-only GET", () => {
  const handlers = Object.getOwnPropertyNames(SpocController.prototype).filter(
    (name) => name !== "constructor",
  );
  assert.ok(handlers.length >= 12);
  for (const name of handlers) {
    const method = Reflect.getMetadata(
      METHOD_METADATA,
      (SpocController.prototype as unknown as Record<string, object>)[name]!,
    ) as RequestMethod;
    assert.equal(method, RequestMethod.GET, `${name} must be GET`);
  }
});

void test("the SPOC_RM role migration grants no write permission", () => {
  const sql = readFileSync(
    join(
      __dirname,
      "../prisma/migrations/20260925120000_spoc_rm_role/migration.sql",
    ),
    "utf8",
  );
  const granted = JSON.parse(/'(\[[^']*\])'/.exec(sql)![1]!) as string[];
  assert.deepEqual(granted, ["dashboard:read", "notification:read"]);
  assert.ok(
    granted.every(
      (permission) =>
        !/:(write|create|transition|manage|generate|review)$/.test(permission),
    ),
  );
});

void test("SPOC_RM cannot be combined with a workflow role", () => {
  assert.throws(
    () => assertSafeRoleCombination(["SPOC_RM", "OPS_MANAGER"], true),
    ConflictException,
  );
  assert.doesNotThrow(() => assertSafeRoleCombination(["SPOC_RM"]));
});

void test("every case status maps to exactly one holder role", () => {
  for (const status of CaseStatuses) assert.ok(holderOf(status));
  assert.deepEqual(statusesHeldBy("QA_REVIEWER"), ["QA_REVIEW"]);
  assert.deepEqual(statusesHeldBy("FINANCE_MANAGER"), ["PAYMENT_PENDING"]);
  assert.equal(holderOf("COMPLETED"), "NONE");
});

void test("current owner follows the role that holds the case", () => {
  const base = {
    client: { displayName: "Acme" },
    assignedOpsUser: { displayName: "Ops One" },
    qaReviewer: null,
    checks: [
      { tasks: [{ status: "IN_PROGRESS", assignee: { displayName: "Vera" } }] },
      { tasks: [{ status: "COMPLETED", assignee: { displayName: "Old" } }] },
    ],
    fieldVisits: [{ status: "ASSIGNED", assignee: { displayName: "Fiona" } }],
  };
  assert.equal(currentOwner({ ...base, status: "IN_PROGRESS" }), "Vera, Fiona");
  assert.equal(currentOwner({ ...base, status: "QA_REVIEW" }), "Unclaimed");
  assert.equal(currentOwner({ ...base, status: "MANAGER_REVIEW" }), "Ops One");
  assert.equal(currentOwner({ ...base, status: "DOCUMENT_PENDING" }), "Acme");
  assert.equal(currentOwner({ ...base, status: "COMPLETED" }), null);
});

void test("SPOC_RM is not allowed on any route outside the read-only /spoc controller", async () => {
  const files: string[] = [];
  const walk = (dir: string) =>
    readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".controller.ts")) files.push(path);
    });
  walk(join(__dirname, "../src"));
  let checked = 0;
  for (const file of files) {
    const exported = (await import(pathToFileURL(file).href)) as Record<
      string,
      unknown
    >;
    for (const value of Object.values(exported)) {
      if (typeof value !== "function" || value === SpocController) continue;
      const targets = [
        value,
        ...Object.getOwnPropertyNames(value.prototype ?? {}).map(
          (name) => (value.prototype as Record<string, unknown>)[name],
        ),
      ];
      for (const target of targets) {
        if (typeof target !== "function") continue;
        const roles = Reflect.getMetadata(ROLES_KEY, target) as
          string[] | undefined;
        if (roles) checked += 1;
        assert.ok(
          !roles?.includes("SPOC_RM"),
          `${file} must not allow SPOC_RM`,
        );
      }
    }
  }
  assert.ok(checked > 50, "role metadata was actually inspected");
});

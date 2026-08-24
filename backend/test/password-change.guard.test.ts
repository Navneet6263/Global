import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PasswordChangeGuard } from "../src/common/auth/password-change.guard";
import type { Actor } from "../src/common/auth/actor";

const actor = (mustChangePassword: boolean): Actor => ({
  userId: 1n,
  userPublicId: "00000000-0000-4000-8000-000000000001",
  tenantId: 1n,
  tenantPublicId: "00000000-0000-4000-8000-000000000002",
  tenantName: "Sapling Global",
  email: "user@sapling.example",
  displayName: "User",
  mustChangePassword,
  roles: [],
  permissions: [],
});

function context(user: Actor): ExecutionContext {
  return {
    getHandler: () => context,
    getClass: () => PasswordChangeGuard,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

void test("temporary-password accounts are blocked from ordinary protected operations", () => {
  const guard = new PasswordChangeGuard(new Reflector());
  assert.throws(
    () => guard.canActivate(context(actor(true))),
    ForbiddenException,
  );
});

void test("accounts that completed password setup retain protected access", () => {
  const guard = new PasswordChangeGuard(new Reflector());
  assert.equal(guard.canActivate(context(actor(false))), true);
});

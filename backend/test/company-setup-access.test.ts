import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { Permission } from "../src/common/auth/permissions";
import { ClientsController } from "../src/clients/clients.controller";
import { assertCanCreateClient } from "../src/clients/clients.service";
import { WorkflowController } from "../src/workflow/workflow.controller";
import { passesGuard } from "./helpers/guard-check";
import { testActor } from "./helpers/test-actor";

const admin = testActor(["PLATFORM_ADMIN"], ["*"]);
// Operations has no client:write in its role; it sets up companies by its role.
const ops = testActor(["OPS_MANAGER"], [Permission.ClientRead, Permission.UserRead]);
const sales = testActor(["SALES_MANAGER"], [Permission.ClientRead, Permission.ClientWrite]);
const salesReadOnly = testActor(["SALES_MANAGER"], [Permission.ClientRead]);
const rm = testActor(["SPOC_RM"], ["*"]);
const verifier = testActor(["VERIFIER"], [Permission.TaskRead]);

void test("Platform Admin (view-only) and Operations can create a company", () => {
  assert.ok(passesGuard(ClientsController, "create", admin));
  assert.ok(passesGuard(ClientsController, "create", ops));
  assert.ok(passesGuard(ClientsController, "create", sales));
  assert.doesNotThrow(() => assertCanCreateClient(admin));
  assert.doesNotThrow(() => assertCanCreateClient(ops));
  assert.doesNotThrow(() => assertCanCreateClient(sales));
});

void test("other roles cannot create a company", () => {
  assert.ok(!passesGuard(ClientsController, "create", rm));
  assert.ok(!passesGuard(ClientsController, "create", verifier));
  assert.throws(() => assertCanCreateClient(salesReadOnly), ForbiddenException);
});

void test("editing a company keeps its old rule", () => {
  assert.ok(!passesGuard(ClientsController, "update", admin));
  assert.ok(!passesGuard(ClientsController, "update", ops));
});

void test("Platform Admin (view-only) and Operations can assign or clear the company RM", () => {
  for (const handler of ["assignClientRm", "clearClientRm", "listClientRms"]) {
    assert.ok(passesGuard(WorkflowController, handler, admin), handler);
    assert.ok(passesGuard(WorkflowController, handler, ops), handler);
    assert.ok(!passesGuard(WorkflowController, handler, rm), handler);
  }
  // Intake rules stay an Operations decision.
  assert.ok(!passesGuard(WorkflowController, "setIntakeRules", admin));
  assert.ok(passesGuard(WorkflowController, "setIntakeRules", ops));
});

import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ClientCommercialController } from "../src/clients/client-commercial.controller";
import { MonthlyStatementController } from "../src/finance/monthly-statement.controller";
import { PERMISSIONS_KEY, ROLES_KEY } from "../src/common/auth/auth.decorators";

void test("commercial configuration requires explicit administrative/sales roles and read/write permission", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, ClientCommercialController), [
    "PLATFORM_ADMIN",
    "SALES_MANAGER",
  ]);
  assert.deepEqual(
    methodMetadata(
      ClientCommercialController.prototype,
      "get",
      PERMISSIONS_KEY,
    ),
    ["client:read"],
  );
  assert.deepEqual(
    methodMetadata(
      ClientCommercialController.prototype,
      "update",
      PERMISSIONS_KEY,
    ),
    ["client:write"],
  );
});

void test("monthly statements expose separate guarded client and finance endpoints", () => {
  assert.deepEqual(
    methodMetadata(MonthlyStatementController.prototype, "client", ROLES_KEY),
    ["CLIENT_ADMIN"],
  );
  assert.deepEqual(
    methodMetadata(MonthlyStatementController.prototype, "finance", ROLES_KEY),
    ["PLATFORM_ADMIN", "FINANCE_MANAGER"],
  );
  assert.deepEqual(
    methodMetadata(
      MonthlyStatementController.prototype,
      "finance",
      PERMISSIONS_KEY,
    ),
    ["finance:read"],
  );
});

function methodMetadata(prototype: object, name: string, key: string): unknown {
  const method = Object.getOwnPropertyDescriptor(prototype, name)
    ?.value as object;
  return Reflect.getMetadata(key, method) as unknown;
}

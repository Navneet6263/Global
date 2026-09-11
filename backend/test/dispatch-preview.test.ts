import assert from "node:assert/strict";
import { test } from "node:test";
import { DispatchPreviewService } from "../src/cases/dispatch/dispatch-preview.service";
import { DispatchController } from "../src/cases/dispatch/dispatch.controller";
import {
  PERMISSIONS_KEY,
  ROLES_KEY,
  IS_PUBLIC_KEY,
} from "../src/common/auth/auth.decorators";
import { PrismaService } from "../src/database/prisma.service";
import {
  dispatchActor,
  dispatchRecord,
  uuid,
} from "./fixtures/dispatch.fixture";

void test("preview is read-only, scoped and includes scoped active/overdue workload", async () => {
  const queries: unknown[] = [];
  const prisma = {
    verificationCase: {
      findMany: (query: unknown) => {
        queries.push(query);
        return Promise.resolve([dispatchRecord()]);
      },
    },
    user: {
      findMany: (query: unknown) => {
        queries.push(query);
        return Promise.resolve([
          {
            id: 6n,
            publicId: uuid(6),
            displayName: "Verifier",
            email: "verifier@example.invalid",
            branchId: 3n,
            clientId: null,
            branch: { name: "Branch" },
          },
        ]);
      },
    },
    checkTask: {
      groupBy: (query: unknown) => {
        queries.push(query);
        return Promise.resolve([{ assigneeId: 6n, _count: { _all: 3 } }]);
      },
    },
  };
  const service = new DispatchPreviewService(
    prisma as unknown as PrismaService,
  );
  const result = await service.preview(dispatchActor, [uuid(10), uuid(11)]);
  assert.equal(result.cases[0]?.ready, true);
  assert.deepEqual(result.cases[0]?.eligibleVerifierIds, [uuid(6)]);
  assert.deepEqual(result.unavailableIds, [uuid(11)]);
  assert.equal(result.verifiers[0]?.activeChecks, 3);
  assert.equal(result.verifiers[0]?.overdue, 3);
  assert.equal(result.workloadScope, "Current authorised workspace");
  assert.equal(queries.length, 4);
  const serialized = queries.map((query) =>
    JSON.stringify(query, (_, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
  assert.ok(serialized.every((query) => query.includes('"tenantId":"2"')));
  assert.ok(serialized[2]?.includes('"branchId":"3"'));
});

void test("unavailable cases never trigger a verifier directory/workload lookup", async () => {
  const prisma = { verificationCase: { findMany: () => Promise.resolve([]) } };
  const result = await new DispatchPreviewService(
    prisma as unknown as PrismaService,
  ).preview(dispatchActor, [uuid(10)]);
  assert.deepEqual(result.cases, []);
  assert.deepEqual(result.verifiers, []);
  assert.deepEqual(result.unavailableIds, [uuid(10)]);
});

void test("dispatch routes require operations role AND case transition/task write permissions", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, DispatchController), [
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
  ]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, DispatchController), [
    "case:read",
    "case:transition",
    "task:write",
  ]);
  assert.notEqual(Reflect.getMetadata(IS_PUBLIC_KEY, DispatchController), true);
  // Reflection only; no unbound method invocation.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const preview = DispatchController.prototype.preview;
  assert.ok(
    (
      Reflect.getMetadata("__headers__", preview) as {
        name: string;
        value: string;
      }[]
    ).some(
      (header) =>
        header.name === "Cache-Control" && header.value === "no-store",
    ),
  );
});

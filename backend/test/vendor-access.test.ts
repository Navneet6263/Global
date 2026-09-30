import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ROLES_KEY } from "../src/common/auth/auth.decorators";
import type { PrismaService } from "../src/database/prisma.service";
import type { CreateUserDto } from "../src/users/dto/create-user.dto";
import { assertCanCreateUser } from "../src/users/ops-user-creation";
import { UsersService } from "../src/users/users.service";
import { SpocVendorsController } from "../src/vendor-requests/spoc-vendors.controller";
import { VendorRequestsController } from "../src/vendor-requests/vendor-requests.controller";
import { VendorActivityController } from "../src/vendor-requests/vendor-activity.controller";
import { VendorReportsController } from "../src/vendor-requests/vendor-reports.controller";
import { VendorTeamController } from "../src/vendor-requests/vendor-team.controller";
import { allControllerHandlers, passesGuard } from "./helpers/guard-check";
import { testActor } from "./helpers/test-actor";
import {
  CLIENT_A,
  admin,
  opsBranch,
  spocA,
  vendorOne,
  type Args,
} from "./helpers/vendor-fixtures";

void test("/spoc/vendors admits SPOC-RM and Platform Admin; /vendor/requests admits Vendors only", () => {
  const spocMethods = [
    "clients",
    "documents",
    "detail",
    "preview",
    "vendors",
    "assign",
    "reassign",
    "requestReupload",
  ];
  const noAssign = { ...spocA, permissions: ["dashboard:read"] };
  for (const method of spocMethods) {
    assert.ok(passesGuard(SpocVendorsController, method, spocA), method);
    assert.ok(passesGuard(SpocVendorsController, method, admin), method);
    assert.ok(!passesGuard(SpocVendorsController, method, noAssign));
    for (const role of ["VENDOR", "OPS_MANAGER", "CLIENT_ADMIN", "VERIFIER"])
      assert.ok(
        !passesGuard(SpocVendorsController, method, testActor([role], ["*"])),
        `${role} ${method}`,
      );
  }
  for (const method of ["list", "detail", "preview", "decide"]) {
    assert.ok(passesGuard(VendorRequestsController, method, vendorOne));
    for (const who of [admin, spocA, testActor(["OPS_MANAGER"], ["*"])])
      assert.ok(
        !passesGuard(VendorRequestsController, method, who),
        `${who.roles[0]} ${method}`,
      );
  }
});

void test("VENDOR is allowed only on the /vendor requests, reports, team and logs routes", async () => {
  const vendorControllers: readonly object[] = [
    VendorRequestsController,
    VendorTeamController,
    VendorReportsController,
    VendorActivityController,
  ];
  let checked = 0;
  for (const { file, controller, handler } of await allControllerHandlers()) {
    if (vendorControllers.includes(controller)) continue;
    for (const target of [controller, handler]) {
      const roles = Reflect.getMetadata(ROLES_KEY, target) as
        string[] | undefined;
      if (roles) checked += 1;
      assert.ok(!roles?.includes("VENDOR"), `${file} must not allow VENDOR`);
    }
  }
  assert.ok(checked > 50, "role metadata was actually inspected");
});

void test("the migration grants VENDOR only its own review permission and keeps one attempt per number", () => {
  const sql = readFileSync(
    join(
      __dirname,
      "../prisma/migrations/20260928100000_vendor_assignments/migration.sql",
    ),
    "utf8",
  );
  const granted = JSON.parse(
    /'VENDOR', 'VENDOR', '(\[[^']*\])'/.exec(sql)![1]!,
  ) as string[];
  assert.deepEqual(granted, ["vendor:review", "notification:read"]);
  assert.match(
    sql,
    /\[VendorAssignment_documentId_attempt_key\] UNIQUE NONCLUSTERED \(\[documentId\],\[attempt\]\)/,
  );
});

void test("Vendor IDs reuse user creation, need the Ops toggle and never carry a client", async () => {
  const off = {
    tenantAccessPolicy: {
      findUnique: () => Promise.resolve({ opsUserCreationEnabled: false }),
    },
  } as unknown as PrismaService;
  await assert.rejects(
    assertCanCreateUser(off, opsBranch, { roleCodes: ["VENDOR"] }),
    ForbiddenException,
  );
  let created: Args | undefined;
  const prisma = {
    tenantAccessPolicy: {
      findUnique: () => Promise.resolve({ opsUserCreationEnabled: true }),
    },
    user: { findFirst: () => Promise.resolve(null) },
    role: {
      findMany: ({ where }: { where: { code: { in: string[] } } }) =>
        Promise.resolve(
          where.code.in.map((code, index) => ({ id: BigInt(index + 1), code })),
        ),
    },
    branch: { findFirst: () => Promise.resolve(null) },
    client: { findFirst: () => Promise.resolve({ id: 21n }) },
    $transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work({
        user: {
          create: (value: Args) => {
            created = value;
            return Promise.resolve({ publicId: "u-9", email: "v@example.com" });
          },
        },
        auditEvent: { create: () => Promise.resolve({}) },
      }),
  } as unknown as PrismaService;
  const service = new UsersService(prisma);
  const input = {
    email: "v@example.com",
    displayName: "Acme Vendors",
    roleCodes: ["VENDOR"],
    temporaryPassword: "Temporary#Pass2026",
  } as CreateUserDto;
  await assert.rejects(
    service.create(opsBranch, { ...input, clientId: CLIENT_A }),
    ConflictException,
  );
  // Read through a function: the assertion above would otherwise narrow `created` to undefined.
  const createdData = (): Args["data"] => created?.data;
  assert.equal(createdData(), undefined);
  const result = await service.create(opsBranch, input);
  assert.deepEqual(result.roles, ["VENDOR"]);
  assert.ok(createdData());
  assert.equal(createdData()?.clientId, undefined);
  assert.equal(createdData()?.branchId, undefined);
});

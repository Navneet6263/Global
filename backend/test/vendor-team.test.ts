import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateVendorTeamUserService } from "../src/vendor-requests/services/create-vendor-team-user.service";
import { CreateVendorTeamUserDto } from "../src/vendor-requests/vendor-requests.validation";
import { VendorTeamRepository } from "../src/vendor-requests/vendor-team.repository";
import {
  mainVendor,
  teamPrisma,
  teamUser,
} from "./helpers/vendor-team-fixtures";

const input = {
  email: "Asha@XYZ.example",
  displayName: "Asha",
  temporaryPassword: "Temporary#Pass2026",
};

function creator(options: Parameters<typeof teamPrisma>[0] = {}) {
  const fake = teamPrisma(options);
  return {
    ...fake,
    service: new CreateVendorTeamUserService(
      new VendorTeamRepository(fake.prisma),
    ),
  };
}

void test("a Main Vendor creates a VENDOR team user within its limit, locking before counting", async () => {
  const { service, calls, names } = creator({ limit: 2, active: 1 });
  const created = await service.create(mainVendor, input);
  assert.deepEqual(created.roles, ["VENDOR"]);
  assert.deepEqual(names().slice(0, 5), [
    "lock",
    "policy",
    "count",
    "email",
    "roles",
  ]);
  const lock = calls.find((call) => call.name === "lock")!.args.where as Record<
    string,
    unknown
  >;
  assert.equal(lock.id, 31n);
  assert.equal(lock.status, "ACTIVE");
  assert.equal(lock.vendorOwnerId, null);
  const count = calls.find((call) => call.name === "count")!.args.where;
  assert.deepEqual(count, {
    tenantId: 7n,
    vendorOwnerId: 31n,
    status: "ACTIVE",
  });
  const data = calls.find((call) => call.name === "create")!.args
    .data as Record<string, unknown>;
  assert.equal(data.vendorOwnerId, 31n);
  assert.equal(data.normalizedEmail, "asha@xyz.example");
  assert.equal(data.branchId, undefined);
  assert.equal(data.clientId, undefined);
  assert.equal(data.mustChangePassword, true);
  assert.deepEqual(data.userRoles, { create: [{ roleId: 9n }] });
  const audit = calls.find((call) => call.name === "audit")!.args.data as {
    afterJson: string;
  };
  const after = JSON.parse(audit.afterJson) as Record<string, unknown>;
  assert.equal(after.createdVia, "VENDOR_TEAM");
  assert.deepEqual(after.roles, ["VENDOR"]);
});

void test("the ACTIVE team count can never reach past the Admin limit", async () => {
  for (const [limit, active] of [
    [2, 2],
    [1, 1],
    [0, 0],
  ] as const) {
    const { service, names } = creator({ limit, active });
    await assert.rejects(service.create(mainVendor, input), ConflictException);
    assert.ok(!names().includes("create"), `limit ${limit}`);
  }
  const none = creator({ limit: null, active: 0 });
  await assert.rejects(none.service.create(mainVendor, input), /not enabled/);
  // Suspended team users are not counted by the ACTIVE-only count, so a slot is free.
  const freed = creator({ limit: 2, active: 1 });
  await freed.service.create(mainVendor, input);
  assert.ok(freed.names().includes("create"));
});

void test("team users, inactive owners and taken emails cannot create", async () => {
  const member = creator();
  await assert.rejects(
    member.service.create(teamUser, input),
    ForbiddenException,
  );
  assert.deepEqual(member.names(), []);
  const inactive = creator({ locked: 0 });
  await assert.rejects(
    inactive.service.create(mainVendor, input),
    ForbiddenException,
  );
  const taken = creator({ emailTaken: true });
  await assert.rejects(
    taken.service.create(mainVendor, input),
    /already exists/,
  );
  assert.ok(!taken.names().includes("create"));
});

void test("the team DTO reuses the user validators and refuses role, branch and client fields", () => {
  const check = (value: Record<string, unknown>) =>
    validateSync(plainToInstance(CreateVendorTeamUserDto, value), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }).map((error) => error.property);
  assert.deepEqual(check(input), []);
  assert.deepEqual(check({ ...input, roleCodes: ["PLATFORM_ADMIN"] }), [
    "roleCodes",
  ]);
  assert.deepEqual(
    check({ ...input, branchId: "00000000-0000-4000-8000-000000000001" }),
    ["branchId"],
  );
  assert.deepEqual(
    check({ ...input, clientId: "00000000-0000-4000-8000-000000000001" }),
    ["clientId"],
  );
  assert.deepEqual(check({ ...input, email: "not-an-email" }), ["email"]);
  assert.deepEqual(check({ ...input, temporaryPassword: "short" }), [
    "temporaryPassword",
  ]);
});

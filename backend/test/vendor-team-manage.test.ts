import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../src/generated/prisma/client";
import { ManageVendorTeamUserService } from "../src/vendor-requests/services/manage-vendor-team-user.service";
import { applyVendorTeamRulesOnEdit } from "../src/vendor-requests/services/vendor-team-rules";
import { VendorTeamRepository } from "../src/vendor-requests/vendor-team.repository";
import {
  MEMBER,
  mainVendor,
  teamPrisma,
  teamUser,
} from "./helpers/vendor-team-fixtures";

function manager(options: Parameters<typeof teamPrisma>[0] = {}) {
  const fake = teamPrisma(options);
  return {
    ...fake,
    service: new ManageVendorTeamUserService(
      new VendorTeamRepository(fake.prisma),
    ),
  };
}

const suspended = {
  id: 42n,
  publicId: MEMBER,
  displayName: "Asha",
  status: "SUSPENDED",
  version: 3,
};

void test("suspending a team user ends its sessions and returns its pending work to the Main Vendor", async () => {
  const { service, calls, names } = manager({ released: 2 });
  const result = await service.setStatus(mainVendor, MEMBER, {
    status: "SUSPENDED",
    version: 3,
  });
  assert.equal(result.requestsReturned, 2);
  assert.deepEqual(names(), [
    "member",
    "status",
    "revoke",
    "release",
    "notify",
    "audit",
  ]);
  const find = calls[0]!.args.where as Record<string, unknown>;
  assert.equal(find.vendorOwnerId, 31n, "only the Main Vendor's own team");
  assert.deepEqual(calls[1]!.args.where, { id: 42n, version: 3 });
  assert.deepEqual(calls[3]!.args.where, {
    tenantId: 7n,
    handlerUserId: 42n,
    status: "PENDING",
  });
  const notice = calls[4]!.args.data as Record<string, unknown>;
  assert.equal(notice.userId, 31n);
  assert.equal(notice.type, "VENDOR_REQUESTS_RETURNED");
});

void test("reactivation must fit the limit; the owner lock comes before the status write", async () => {
  const full = manager({ member: suspended, limit: 2, active: 2 });
  await assert.rejects(
    full.service.setStatus(mainVendor, MEMBER, {
      status: "ACTIVE",
      version: 3,
    }),
    ConflictException,
  );
  assert.ok(!full.names().includes("status"));
  const room = manager({ member: suspended, limit: 2, active: 1 });
  await room.service.setStatus(mainVendor, MEMBER, {
    status: "ACTIVE",
    version: 3,
  });
  const order = room.names();
  assert.ok(order.indexOf("lock") < order.indexOf("status"));
  assert.ok(!order.includes("revoke"));
});

void test("team management is refused for team users, strangers, stale versions and no-ops", async () => {
  await assert.rejects(
    manager().service.setStatus(teamUser, MEMBER, {
      status: "SUSPENDED",
      version: 3,
    }),
    ForbiddenException,
  );
  await assert.rejects(
    manager({ member: null }).service.setStatus(mainVendor, MEMBER, {
      status: "SUSPENDED",
      version: 3,
    }),
    NotFoundException,
  );
  await assert.rejects(
    manager().service.setStatus(mainVendor, MEMBER, {
      status: "SUSPENDED",
      version: 2,
    }),
    /refresh/,
  );
  await assert.rejects(
    manager().service.setStatus(mainVendor, MEMBER, {
      status: "ACTIVE",
      version: 3,
    }),
    /already active/,
  );
});

void test("a Main Vendor resets its team user's password: must change it, every session ends", async () => {
  const { service, calls, names } = manager();
  await service.resetPassword(mainVendor, MEMBER, "Temporary#Pass2026");
  assert.deepEqual(names(), ["member", "password", "revoke", "audit"]);
  const data = calls[1]!.args.data as Record<string, unknown>;
  assert.equal(data.mustChangePassword, true);
  assert.notEqual(data.passwordHash, "Temporary#Pass2026");
  await assert.rejects(
    manager({ member: null }).service.resetPassword(
      mainVendor,
      MEMBER,
      "Temporary#Pass2026",
    ),
    NotFoundException,
  );
  await assert.rejects(
    manager().service.resetPassword(teamUser, MEMBER, "Temporary#Pass2026"),
    ForbiddenException,
  );
});

void test("Platform Admin edits keep the team rules: reactivation fits the limit, roles never orphan a team", async () => {
  const edit = (
    options: Parameters<typeof teamPrisma>[0],
    input: Omit<Parameters<typeof applyVendorTeamRulesOnEdit>[1], "tenantId">,
  ) => {
    const fake = teamPrisma(options);
    return {
      fake,
      run: () =>
        applyVendorTeamRulesOnEdit(
          fake.tx as unknown as Prisma.TransactionClient,
          {
            tenantId: 7n,
            ...input,
          },
        ),
    };
  };
  const member = { id: 42n, displayName: "Asha", vendorOwnerId: 31n };
  const atLimit = edit(
    { limit: 1, active: 1 },
    {
      user: { ...member, status: "SUSPENDED" },
      wasVendor: true,
      staysVendor: true,
      nextStatus: "ACTIVE",
    },
  );
  await assert.rejects(atLimit.run(), ConflictException);
  const leaving = edit(
    { released: 1 },
    {
      user: { ...member, status: "ACTIVE" },
      wasVendor: true,
      staysVendor: false,
      nextStatus: "ACTIVE",
    },
  );
  assert.deepEqual(await leaving.run(), { clearOwner: true });
  assert.ok(leaving.fake.names().includes("release"));
  const owner = {
    id: 31n,
    displayName: "XYZ",
    vendorOwnerId: null,
    status: "ACTIVE",
  };
  await assert.rejects(
    edit(
      { active: 2 },
      {
        user: owner,
        wasVendor: true,
        staysVendor: false,
        nextStatus: "ACTIVE",
      },
    ).run(),
    /still has active team users/,
  );
  assert.deepEqual(
    await edit(
      { active: 0 },
      {
        user: owner,
        wasVendor: true,
        staysVendor: false,
        nextStatus: "ACTIVE",
      },
    ).run(),
    { clearOwner: false },
  );
  const other = edit(
    {},
    {
      user: { id: 5n, displayName: "Ops", status: "ACTIVE" },
      wasVendor: false,
      staysVendor: false,
      nextStatus: "SUSPENDED",
    },
  );
  assert.deepEqual(await other.run(), { clearOwner: false });
  assert.deepEqual(other.fake.names(), [], "non-vendor edits touch nothing");
});

import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaService } from "../src/database/prisma.service";
import type { DocumentsService } from "../src/documents/documents.service";
import { ownRequests } from "../src/vendor-requests/services/vendor-scope";
import { VendorAssignmentsRepository } from "../src/vendor-requests/vendor-assignments.repository";
import { bigJson } from "./helpers/test-actor";
import { spocA, spocMonitor } from "./helpers/vendor-fixtures";
import { MEMBER, mainVendor, teamUser } from "./helpers/vendor-team-fixtures";

void test("a team user's scope is only what its Main Vendor delegated; the Main Vendor's is unchanged", () => {
  assert.deepEqual(ownRequests(mainVendor), {
    tenantId: 7n,
    vendorUserId: 31n,
  });
  assert.deepEqual(ownRequests(teamUser), {
    tenantId: 7n,
    vendorUserId: 31n,
    handlerUserId: 41n,
  });
});

void test("SPOC-RM can list and assign only Main Vendors, never team users", async () => {
  let listWhere: unknown;
  const prisma = {
    user: {
      findMany: (args: { where: unknown }) => {
        listWhere = args.where;
        return Promise.resolve([]);
      },
    },
  } as unknown as PrismaService;
  await spocMonitor(prisma, {} as DocumentsService).vendors(spocA);
  assert.match(bigJson(listWhere), /"vendorOwnerId":null/);
  let assignWhere: unknown;
  const tx = {
    user: {
      findFirst: (args: { where: unknown }) => {
        assignWhere = args.where;
        return Promise.resolve(null);
      },
    },
  };
  await new VendorAssignmentsRepository({} as PrismaService).findActiveVendor(
    tx as never,
    7n,
    MEMBER,
  );
  assert.match(bigJson(assignWhere), /"vendorOwnerId":null/);
});

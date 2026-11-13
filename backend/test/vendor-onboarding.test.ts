import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { ApprovedVendorGuard } from "../src/vendor-onboarding/guards/approved-vendor.guard";
import {
  assertMainVendor,
  isMainVendor,
} from "../src/vendor-requests/services/vendor-scope";
import { VendorOnboardingService } from "../src/vendor-onboarding/vendor-onboarding.service";
import { VendorOnboardingOpsService } from "../src/vendor-onboarding/vendor-onboarding-ops.service";
import type { Actor } from "../src/common/auth/actor";

function mockActor(roles: string[], vendorStatus?: string, vendorOwnerId?: bigint): Actor {
  return {
    userId: 101n,
    tenantId: 1n,
    roles,
    permissions: [],
    email: "vendor@test.com",
    vendorStatus,
    vendorOwnerId,
  };
}

void test("ApprovedVendorGuard allows APPROVED vendor and blocks unapproved vendor", () => {
  const guard = new ApprovedVendorGuard();
  const makeCtx = (actor: Actor) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: actor }),
      }),
    }) as any;

  assert.equal(guard.canActivate(makeCtx(mockActor(["VENDOR"], "APPROVED"))), true);
  assert.throws(
    () => guard.canActivate(makeCtx(mockActor(["VENDOR"], "PENDING_DOCUMENTS"))),
    ForbiddenException,
  );
  assert.throws(
    () => guard.canActivate(makeCtx(mockActor(["VENDOR"], "SUBMITTED"))),
    ForbiddenException,
  );
  assert.throws(
    () => guard.canActivate(makeCtx(mockActor(["VENDOR"], "REJECTED"))),
    ForbiddenException,
  );
  // Non-vendor roles bypass the guard
  assert.equal(guard.canActivate(makeCtx(mockActor(["PLATFORM_ADMIN"]))), true);
});

void test("assertMainVendor permits Main Vendor and blocks Team Member", () => {
  const mainVendor = mockActor(["VENDOR"]);
  const teamMember = mockActor(["VENDOR"], "PENDING_DOCUMENTS", 999n);

  assert.equal(isMainVendor(mainVendor), true);
  assert.equal(isMainVendor(teamMember), false);
  assert.doesNotThrow(() => assertMainVendor(mainVendor));
  assert.throws(() => assertMainVendor(teamMember), ForbiddenException);
});

void test("VendorOnboardingService enforces single-document minimum on submission", async () => {
  const prismaMock: any = {
    vendorProfile: {
      findUnique: async () => ({
        id: 10n,
        vendorUserId: 101n,
        verificationStatus: "PENDING_DOCUMENTS",
      }),
    },
    vendorDocument: {
      count: async () => 0,
    },
  };

  const service = new VendorOnboardingService(prismaMock, null as any, null as any);
  await assert.rejects(
    () => service.submit(mockActor(["VENDOR"])),
    (err: any) => {
      assert.equal(err instanceof BadRequestException, true);
      assert.match(err.message, /at least one legal business document/);
      return true;
    },
  );
});

void test("VendorOnboardingService allows submission when any ONE document exists", async () => {
  let updatedStatus = "";
  const prismaMock: any = {
    vendorProfile: {
      findUnique: async () => ({
        id: 10n,
        vendorUserId: 101n,
        verificationStatus: "PENDING_DOCUMENTS",
      }),
      update: async (args: any) => {
        updatedStatus = args.data.verificationStatus;
        return { id: 10n, ...args.data };
      },
    },
    vendorDocument: {
      count: async () => 1,
    },
  };

  const service = new VendorOnboardingService(prismaMock, null as any, null as any);
  const result = await service.submit(mockActor(["VENDOR"]));
  assert.equal(result.success, true);
  assert.equal(updatedStatus, "PENDING_REVIEW");
});

void test("Ops review requires >= 1 verified document and 0 rejected documents to approve", async () => {
  const prismaMock: any = {
    vendorProfile: {
      findFirst: async () => ({
        id: 10n,
        publicId: "vp-123",
        tenantId: 1n,
        documents: [
          { id: 1n, status: "REJECTED" },
          { id: 2n, status: "VERIFIED" },
        ],
      }),
    },
  };

  const opsService = new VendorOnboardingOpsService(prismaMock, null as any);
  const opsActor = mockActor(["OPERATIONS_ADMIN"]);

  // Fails because one document is REJECTED
  await assert.rejects(
    () => opsService.approveVendor(opsActor, "vp-123"),
    (err: any) => {
      assert.equal(err instanceof BadRequestException, true);
      assert.match(err.message, /marked REJECTED/);
      return true;
    },
  );
});

void test("Ops review successfully approves when single document is VERIFIED", async () => {
  let profileApproved = false;
  const prismaMock: any = {
    vendorProfile: {
      findFirst: async () => ({
        id: 10n,
        publicId: "vp-123",
        tenantId: 1n,
        documents: [
          { id: 1n, status: "VERIFIED" },
        ],
      }),
      update: async (args: any) => {
        if (args.data.verificationStatus === "APPROVED") profileApproved = true;
        return { id: 10n, ...args.data };
      },
    },
  };

  const opsService = new VendorOnboardingOpsService(prismaMock, null as any);
  const opsActor = mockActor(["OPERATIONS_ADMIN"]);

  const res = await opsService.approveVendor(opsActor, "vp-123");
  assert.equal(res.verificationStatus, "APPROVED");
  assert.equal(profileApproved, true);
});

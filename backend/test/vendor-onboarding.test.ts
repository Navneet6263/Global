import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type ExecutionContext,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { AuthenticationService } from "../src/auth/authentication.service";
import { ApprovedVendorGuard } from "../src/vendor-onboarding/guards/approved-vendor.guard";
import {
  assertMainVendor,
  isMainVendor,
} from "../src/vendor-requests/services/vendor-scope";
import {
  VendorOnboardingService,
  safeFileName,
} from "../src/vendor-onboarding/vendor-onboarding.service";
import { VendorOnboardingOpsService } from "../src/vendor-onboarding/vendor-onboarding-ops.service";
import { VendorSignupService } from "../src/vendor-onboarding/vendor-signup.service";
import { workReadyVendor } from "../src/vendor-onboarding/vendor-approval";

function mockActor(
  roles: string[],
  vendorStatus?: string,
  vendorOwnerId?: bigint,
): Actor {
  return {
    userId: 101n,
    userPublicId: "user-101",
    tenantId: 1n,
    tenantPublicId: "tenant-1",
    tenantName: "Sapling",
    displayName: "Vendor Owner",
    mustChangePassword: false,
    roles,
    permissions: [],
    email: "vendor@test.com",
    vendorStatus,
    vendorOwnerId,
  };
}

const asPrisma = (mock: unknown) => mock as PrismaService;

/** A fake transaction that records the audit rows and notifications it is asked for. */
function recorder() {
  const audits: string[] = [];
  const notifications: string[] = [];
  const tx = {
    auditEvent: {
      create: (args: { data: { action: string } }) => {
        audits.push(args.data.action);
        return Promise.resolve({});
      },
    },
    notification: {
      create: (args: { data: { type: string } }) => {
        notifications.push(args.data.type);
        return Promise.resolve({});
      },
    },
  };
  return { audits, notifications, tx };
}

void test("ApprovedVendorGuard lets only approved vendors in", () => {
  const guard = new ApprovedVendorGuard();
  const ctx = (actor: Actor) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user: actor }) }),
    }) as unknown as ExecutionContext;

  assert.equal(guard.canActivate(ctx(mockActor(["VENDOR"], "APPROVED"))), true);
  for (const status of ["PENDING_UPLOAD", "PENDING_REVIEW", "REJECTED"])
    assert.throws(
      () => guard.canActivate(ctx(mockActor(["VENDOR"], status))),
      ForbiddenException,
    );
  assert.equal(guard.canActivate(ctx(mockActor(["PLATFORM_ADMIN"]))), true);
});

void test("assertMainVendor permits the main vendor and blocks a team member", () => {
  const mainVendor = mockActor(["VENDOR"]);
  const teamMember = mockActor(["VENDOR"], "APPROVED", 999n);
  assert.equal(isMainVendor(mainVendor), true);
  assert.equal(isMainVendor(teamMember), false);
  assert.doesNotThrow(() => assertMainVendor(mainVendor));
  assert.throws(() => assertMainVendor(teamMember), ForbiddenException);
});

function onboarding(status: string, documents: number) {
  const { audits, tx } = recorder();
  const updates: Array<{
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }> = [];
  const prisma = {
    vendorProfile: {
      findUnique: () =>
        Promise.resolve({
          id: 10n,
          publicId: "vp-1",
          vendorUserId: 101n,
          verificationStatus: status,
        }),
    },
    vendorDocument: { count: () => Promise.resolve(documents) },
    $transaction: (work: (client: unknown) => Promise<unknown>) =>
      work({
        ...tx,
        vendorProfile: {
          updateMany: (args: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
          }) => {
            updates.push(args);
            return Promise.resolve({ count: 1 });
          },
        },
      }),
  };
  const service = new VendorOnboardingService(
    asPrisma(prisma),
    null as never,
    null as never,
  );
  return { service, audits, updates };
}

void test("a vendor cannot submit without at least one business document", async () => {
  const { service } = onboarding("PENDING_UPLOAD", 0);
  await assert.rejects(
    () => service.submit(mockActor(["VENDOR"])),
    (error: unknown) =>
      error instanceof BadRequestException &&
      /at least one legal business document/.test(error.message),
  );
});

void test("submitting sends the application for review, conditionally and audited", async () => {
  const { service, audits, updates } = onboarding("PENDING_UPLOAD", 1);
  const result = await service.submit(mockActor(["VENDOR"]));
  assert.equal(result.success, true);
  assert.equal(updates[0]!.data["verificationStatus"], "PENDING_REVIEW");
  // Only a not-yet-sent or rejected application can move to review.
  assert.deepEqual(updates[0]!.where["verificationStatus"], {
    in: ["PENDING_UPLOAD", "REJECTED"],
  });
  assert.deepEqual(audits, ["vendor.application-submitted"]);
});

void test("an approved vendor submitting again is not sent back to review", async () => {
  for (const status of ["APPROVED", "PENDING_REVIEW"]) {
    const { service, updates } = onboarding(status, 1);
    await assert.rejects(
      () => service.submit(mockActor(["VENDOR"])),
      ConflictException,
    );
    assert.equal(updates.length, 0);
  }
});

function ops(status: string, documents: Array<{ status: string }>) {
  const { audits, notifications, tx } = recorder();
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    vendorProfile: {
      findFirst: () =>
        Promise.resolve({
          id: 10n,
          publicId: "vp-1",
          vendorUserId: 101n,
          verificationStatus: status,
          documents: documents.map((doc, index) => ({
            documentType: ["COMPANY_PAN", "GST_CERTIFICATE"][index] ?? "OTHER",
            ...doc,
          })),
        }),
    },
    $transaction: (work: (client: unknown) => Promise<unknown>) =>
      work({
        ...tx,
        vendorProfile: {
          updateMany: (args: { data: Record<string, unknown> }) => {
            updates.push(args.data);
            return Promise.resolve({ count: 1 });
          },
        },
      }),
  };
  const service = new VendorOnboardingOpsService(
    asPrisma(prisma),
    null as never,
  );
  return { service, audits, notifications, updates };
}

void test("one verified document is enough even when another was rejected", async () => {
  const { service, audits, notifications, updates } = ops("PENDING_REVIEW", [
    { status: "REJECTED" },
    { status: "VERIFIED" },
  ]);
  const result = await service.approveVendor(
    mockActor(["OPS_MANAGER"]),
    "vp-1",
  );
  assert.equal(result.verificationStatus, "APPROVED");
  assert.equal(updates[0]!["verificationStatus"], "APPROVED");
  assert.deepEqual(audits, ["vendor.approved"]);
  assert.deepEqual(notifications, ["VENDOR_APPROVED"]);
});

void test("approval needs a verified document and is not repeated", async () => {
  const none = ops("PENDING_REVIEW", [{ status: "PENDING" }]);
  await assert.rejects(
    () => none.service.approveVendor(mockActor(["OPS_MANAGER"]), "vp-1"),
    BadRequestException,
  );
  const again = ops("APPROVED", [{ status: "VERIFIED" }]);
  await assert.rejects(
    () => again.service.approveVendor(mockActor(["OPS_MANAGER"]), "vp-1"),
    ConflictException,
  );
});

void test("rejecting a document or a vendor needs a reason", async () => {
  const { service } = ops("PENDING_REVIEW", [{ status: "PENDING" }]);
  await assert.rejects(
    () =>
      service.reviewDocument(mockActor(["OPS_MANAGER"]), "vp-1", "doc-1", {
        decision: "REJECT",
      }),
    BadRequestException,
  );
  await assert.rejects(
    () =>
      service.rejectVendor(mockActor(["OPS_MANAGER"]), "vp-1", {
        rejectionReason: "  ",
      }),
    BadRequestException,
  );
});

void test("download file names are safe for the browser header", () => {
  assert.equal(safeFileName('GST "copy".pdf'), "GST__copy_.pdf");
  assert.equal(safeFileName("GST प्रमाण.pdf"), "GST_______.pdf");
  assert.equal(safeFileName(""), "document");
});

void test("a company sign-up can never be finished as a vendor", async () => {
  let lookedFor: Record<string, unknown> | undefined;
  const prisma = {
    signupRequest: {
      findFirst: (args: { where: Record<string, unknown> }) => {
        lookedFor = args.where;
        return Promise.resolve(null);
      },
    },
  };
  const service = new VendorSignupService(
    asPrisma(prisma),
    {} as ConfigService,
    {} as SecretBoxService,
    {} as AuthenticationService,
  );
  await assert.rejects(() => service.resend("signup-1"), /expired/);
  assert.equal(lookedFor?.["signupType"], "VENDOR");
});

void test("only Ops-created or approved vendors can be given work", () => {
  assert.deepEqual(workReadyVendor, {
    OR: [
      { vendorProfile: { is: null } },
      { vendorProfile: { is: { verificationStatus: "APPROVED" } } },
    ],
  });
});

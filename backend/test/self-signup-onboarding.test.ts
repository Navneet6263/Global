import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import { isViewOnlyAdmin } from "../src/common/auth/view-only";
import { isFreeEmail } from "../src/common/mail/free-email";
import { renderEmail } from "../src/common/mail/email-templates";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import { assertClientActivation } from "../src/clients/client-activation.policy";
import type { PrismaService } from "../src/database/prisma.service";
import { AuthController } from "../src/auth/auth.controller";
import type { AuthenticationService } from "../src/auth/authentication.service";
import {
  maskEmail,
  SignupService,
  signupClientCode,
} from "../src/auth/signup.service";
import { CasesController } from "../src/cases/cases.controller";
import { ClientsController } from "../src/clients/clients.controller";
import { NotificationsController } from "../src/notifications/notifications.controller";
import {
  SELF_SIGNUP_KYC_TYPES,
  checklistProgress,
} from "../src/onboarding/onboarding-checklist";
import { OnboardingService } from "../src/onboarding/onboarding.service";
import { passesGuard } from "./helpers/guard-check";
import { testActor } from "./helpers/test-actor";

const config = (values: Record<string, unknown> = {}) =>
  ({
    get: (key: string, fallback?: unknown) =>
      key in values ? values[key] : fallback,
    getOrThrow: (key: string) => values[key],
  }) as unknown as ConfigService;
const secretBox = {
  seal: (value: unknown) => JSON.stringify(value),
} as unknown as SecretBoxService;
const meta = { ipAddress: "10.0.0.1" };

function signupHarness(overrides: { existingUser?: boolean } = {}) {
  const calls: Array<{ kind: string; data: unknown }> = [];
  const record =
    (kind: string, result: unknown = {}) =>
    (data: unknown) => {
      calls.push({ kind, data });
      return Promise.resolve(result);
    };
  let pending: Record<string, unknown> | null = null;
  const tx = {
    signupRequest: {
      updateMany: (input: { data: Record<string, unknown> }) => {
        calls.push({ kind: "signup.updateMany", data: input });
        return Promise.resolve({ count: 1 });
      },
      create: (input: { data: Record<string, unknown> }) => {
        pending = {
          ...input.data,
          id: 9n,
          sendCount: 1,
          otpAttempts: 0,
          lastSentAt: new Date(0),
        };
        calls.push({ kind: "signup.create", data: input });
        return Promise.resolve({ publicId: input.data.publicId });
      },
    },
    outboxEvent: { create: record("outbox") },
    user: {
      count: () => Promise.resolve(0),
      create: record("user.create", { id: 70n, publicId: "user-70" }),
      findMany: () => Promise.resolve([{ id: 5n }, { id: 6n }]),
    },
    client: {
      count: () => Promise.resolve(0),
      create: record("client.create", {
        id: 40n,
        publicId: "client-40",
        displayName: "Acme Tech",
      }),
    },
    auditEvent: { createMany: record("audit") },
    notification: { createMany: record("notify") },
  };
  const prisma = {
    tenant: { findFirst: () => Promise.resolve({ id: 1n }) },
    user: { count: () => Promise.resolve(overrides.existingUser ? 1 : 0) },
    role: { findFirst: () => Promise.resolve({ id: 3n }) },
    signupRequest: {
      count: () => Promise.resolve(0),
      findFirst: () => Promise.resolve(pending),
      update: record("signup.update"),
    },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const signedIn: bigint[] = [];
  const authentication = {
    signInVerifiedUser: (userId: bigint) => {
      signedIn.push(userId);
      return Promise.resolve({ tokens: {}, session: { id: "user-70" } });
    },
  } as unknown as AuthenticationService;
  const service = new SignupService(
    prisma,
    config({ SELF_SIGNUP_ENABLED: true }),
    secretBox,
    authentication,
  );
  return { service, calls, signedIn, pending: () => pending };
}

const startInput = {
  fullName: "Riya Mehta",
  companyName: "Acme Tech",
  email: "Riya@AcmeTech.in",
  phone: "+91 98765 43210",
  password: "Strong#Pass1",
  acceptTerms: true,
};

void test("sign-up emails a sealed 6-digit code and never creates the account first", async () => {
  const { service, calls } = signupHarness();
  const challenge = await service.start(startInput, meta);
  assert.equal(challenge.email, "Ri**@AcmeTech.in");
  assert.equal(challenge.resendAfterSeconds, 45);
  const outbox = calls.find((call) => call.kind === "outbox")?.data as {
    data: { topic: string; payloadJson: string };
  };
  assert.equal(outbox.data.topic, "email.requested");
  const sealed = JSON.parse(
    JSON.parse(outbox.data.payloadJson).secret as string,
  ) as {
    to: string;
    template: string;
    variables: { otp: string };
  };
  assert.equal(sealed.template, "signup-otp");
  assert.match(sealed.variables.otp, /^\d{6}$/);
  const created = calls.find((call) => call.kind === "signup.create")?.data as {
    data: { otpHash: string; normalizedEmail: string; passwordHash: string };
  };
  assert.equal(created.data.normalizedEmail, "riya@acmetech.in");
  assert.notEqual(created.data.otpHash, sealed.variables.otp);
  assert.match(created.data.passwordHash, /^scrypt\$/);
  assert.ok(!calls.some((call) => call.kind === "user.create"));
});

void test("sign-up refuses an existing email and a weak password", async () => {
  await assert.rejects(
    signupHarness({ existingUser: true }).service.start(startInput, meta),
    ConflictException,
  );
  await assert.rejects(
    signupHarness().service.start(
      { ...startInput, password: "weakpass" },
      meta,
    ),
    BadRequestException,
  );
});

void test("the right code creates an ONBOARDING company, its admin, audit, Ops notices and a session", async () => {
  const { service, calls, signedIn, pending } = signupHarness();
  const challenge = await service.start(startInput, meta);
  const outbox = calls.find((call) => call.kind === "outbox")?.data as {
    data: { payloadJson: string };
  };
  const otp = (
    JSON.parse(JSON.parse(outbox.data.payloadJson).secret as string) as {
      variables: { otp: string };
    }
  ).variables.otp;
  const wrong = otp === "000000" ? "111111" : "000000";
  await assert.rejects(
    service.verify(challenge.signupId, wrong, meta),
    /Incorrect code/,
  );
  (pending() as Record<string, unknown>).otpAttempts = 0;
  await service.verify(challenge.signupId, otp, meta);
  const client = calls.find((call) => call.kind === "client.create")?.data as {
    data: { status: string; selfSignupAt: Date; code: string };
  };
  assert.equal(client.data.status, "ONBOARDING");
  assert.ok(client.data.selfSignupAt instanceof Date);
  assert.match(client.data.code, /^ACMETE-[0-9A-F]{4}$/);
  const user = calls.find((call) => call.kind === "user.create")?.data as {
    data: { mustChangePassword: boolean; clientId: bigint; userRoles: unknown };
  };
  assert.equal(user.data.mustChangePassword, false);
  assert.equal(user.data.clientId, 40n);
  const audits = calls.find((call) => call.kind === "audit")?.data as {
    data: Array<{ action: string }>;
  };
  assert.deepEqual(
    audits.data.map((row) => row.action),
    ["client.self-signup", "user.self-registered"],
  );
  const notices = calls.find((call) => call.kind === "notify")?.data as {
    data: Array<{ href: string }>;
  };
  assert.equal(notices.data.length, 2);
  assert.match(notices.data[0]!.href, /^\/operations\/onboarding\?company=/);
  assert.deepEqual(signedIn, [70n]);
});

void test("helpers: code, mask, personal email, OTP email", () => {
  assert.match(signupClientCode("  ### "), /^CLIENT-/);
  assert.equal(maskEmail("ab@x.io"), "ab*@x.io");
  assert.ok(isFreeEmail("someone@Gmail.com"));
  assert.ok(!isFreeEmail("hr@acmetech.in"));
  const email = renderEmail("signup-otp", {
    otp: "123456",
    name: "<b>Riya</b>",
    companyName: "Acme",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });
  assert.match(email.subject, /123456/);
  assert.ok(!email.html.includes("<b>Riya</b>"), "variables are escaped");
});

const company = {
  legalName: "Acme Tech Pvt Ltd",
  gstin: "27ABCDE1234F1Z5",
  pan: "ABCDE1234F",
  billingAddress: "Pune",
  billingTerms: null as string | null,
  primaryRmUserId: null as bigint | null,
  packageRates: [] as Array<{ active: boolean }>,
  agreements: [] as Array<{ type: string; files: Array<{ status: string }> }>,
};

void test("checklist: client part done when details and required documents are uploaded", () => {
  const empty = checklistProgress({ ...company, gstin: null });
  assert.equal(empty.clientDone, false);
  assert.ok(empty.missing.some((item) => item.startsWith("company details")));
  const uploaded = checklistProgress({
    ...company,
    agreements: [
      "AGREEMENT",
      "DPA",
      "GST_CERTIFICATE",
      "PAN",
      "SIGNATORY_AUTHORITY",
    ].map((type) => ({
      type,
      files: [{ status: type === "PAN" ? "APPROVED" : "PENDING" }],
    })),
  });
  assert.equal(uploaded.clientDone, true);
  assert.equal(uploaded.documentsUploaded, 5);
  assert.equal(uploaded.documentsApproved, 1);
  assert.ok(uploaded.percent > 40 && uploaded.percent < 100);
  const rejected = checklistProgress({
    ...company,
    agreements: [{ type: "PAN", files: [{ status: "REJECTED" }] }],
  });
  assert.ok(rejected.missing.includes("Company PAN card (re-upload)"));
});

void test("self sign-up activation needs approved KYC proofs as well as AGREEMENT and DPA", () => {
  const approved = (type: string) => ({
    type,
    signedAt: new Date(Date.now() - 86_400_000),
    expiresAt: null,
    files: [{ status: "APPROVED" }],
  });
  const base = {
    billingTerms: "30 days",
    billingAddress: "Pune",
    packageRates: [{ active: true }],
    agreements: [approved("AGREEMENT"), approved("DPA")],
  };
  assert.doesNotThrow(() => assertClientActivation(base));
  assert.throws(
    () => assertClientActivation(base, new Date(), SELF_SIGNUP_KYC_TYPES),
    /GST_CERTIFICATE/,
  );
  assert.doesNotThrow(() =>
    assertClientActivation(
      {
        ...base,
        agreements: [
          ...base.agreements,
          ...SELF_SIGNUP_KYC_TYPES.map(approved),
        ],
      },
      new Date(),
      SELF_SIGNUP_KYC_TYPES,
    ),
  );
});

void test("Platform Admin is view-only: reads pass, writes fail, escalation and own session still work", () => {
  const admin = testActor(["PLATFORM_ADMIN"], ["*"]);
  assert.ok(isViewOnlyAdmin(["PLATFORM_ADMIN"], true));
  assert.ok(!isViewOnlyAdmin(["PLATFORM_ADMIN", "OPS_MANAGER"], true));
  assert.ok(!isViewOnlyAdmin(["PLATFORM_ADMIN"], false));
  assert.ok(passesGuard(CasesController, "list", admin));
  assert.ok(passesGuard(ClientsController, "list", admin));
  assert.ok(!passesGuard(ClientsController, "create", admin));
  assert.ok(!passesGuard(CasesController, "transition", admin));
  assert.ok(passesGuard(CasesController, "escalate", admin));
  assert.ok(passesGuard(AuthController, "changePassword", admin));
  assert.ok(passesGuard(NotificationsController, "markAllRead", admin));
  // Switched off, the admin writes again.
  assert.ok(
    passesGuard(ClientsController, "create", admin, {
      platformAdminViewOnly: false,
    }),
  );
});

function onboardingHarness() {
  const row = {
    id: 40n,
    publicId: "client-40",
    status: "ONBOARDING",
    displayName: "Acme Tech",
    contactEmail: "hr@acmetech.in",
    selfSignupAt: new Date(),
    onboardingSubmittedAt: null,
    primaryRmUserId: 60n,
    version: 3,
    ...company,
  };
  const prisma = {
    client: { findFirst: () => Promise.resolve(row) },
  } as unknown as PrismaService;
  return new OnboardingService(
    prisma,
    {} as never,
    {} as never,
    secretBox,
    config(),
  );
}

const clientAdmin: Actor = {
  ...testActor(["CLIENT_ADMIN"], ["case:read"]),
  clientId: 40n,
};

void test("onboarding: without an assigned RM only Operations approves; the client cannot submit an incomplete checklist", async () => {
  const service = onboardingHarness();
  const rm = testActor(["SPOC_RM"], ["case:read"]);
  await assert.rejects(
    service.activate(rm, "client-40", { version: 3 }),
    ForbiddenException,
  );
  await assert.rejects(
    service.reject(testActor(["PLATFORM_ADMIN"], ["*"]), "client-40", {
      version: 3,
      reason: "Not a real company",
    }),
    ForbiddenException,
  );
  await assert.rejects(
    service.submit(clientAdmin, { version: 3 }),
    /Complete before submitting/,
  );
  await assert.rejects(
    service.mine(testActor(["OPS_MANAGER"], ["case:read"])),
    ForbiddenException,
  );
});

void test("the company's assigned RM approves onboarding and uses package list prices", async () => {
  const rm = { ...testActor(["SPOC_RM"], ["case:read"]), userId: 60n };
  const otherRm = {
    ...testActor(["SPOC_RM"], ["case:read"]),
    userId: 61n,
  };
  const saved: Array<{ packages: Array<Record<string, unknown>> }> = [];
  const row = {
    id: 40n,
    publicId: "client-40",
    status: "ONBOARDING",
    displayName: "Acme Tech",
    selfSignupAt: new Date(),
    version: 3,
    ...company,
    primaryRmUserId: 60n,
    packageRates: [],
  };
  const prisma = {
    client: { findFirst: () => Promise.resolve(row) },
    servicePackage: {
      findMany: () =>
        Promise.resolve([{ publicId: "pkg-1", price: 1200, tatHours: 72 }]),
    },
  } as unknown as PrismaService;
  const commercial = {
    update: (_actor: Actor, _id: string, input: (typeof saved)[number]) => {
      saved.push(input);
      return Promise.resolve();
    },
  };
  const service = new OnboardingService(
    prisma,
    {} as never,
    commercial as never,
    secretBox,
    config(),
  );
  // Stop after saving: the detail re-read is not part of this check.
  (service as unknown as { detail: () => Promise<string> }).detail = () =>
    Promise.resolve("ok");
  await service.updateCommercial(rm, "client-40", {
    version: 3,
    billingTerms: "Net 30 days",
    packages: [
      { servicePackageId: "pkg-1", unitPrice: 1, taxRate: 18, active: true },
    ],
  });
  // The RM's typed price is ignored: the package keeps its list price and turnaround.
  assert.deepEqual(saved[0]!.packages, [
    {
      servicePackageId: "pkg-1",
      unitPrice: 1200,
      taxRate: 18,
      tatHours: 72,
      active: true,
    },
  ]);
  await assert.rejects(
    service.activate(otherRm, "client-40", { version: 3 }),
    /assigned RM/,
  );
  // The assigned RM passes the approval gate (the activation itself needs more data).
  await assert.rejects(
    service.activate(rm, "client-40", { version: 3 }),
    (error: Error) => !/assigned RM|Operations Manager/.test(error.message),
  );
});

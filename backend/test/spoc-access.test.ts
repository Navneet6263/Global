import "reflect-metadata";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import {
  ConflictException,
  ForbiddenException,
  RequestMethod,
  type ExecutionContext,
} from "@nestjs/common";
import { METHOD_METADATA } from "@nestjs/common/constants";
import type { Reflector } from "@nestjs/core";
import type { Actor } from "../src/common/auth/actor";
import { PERMISSIONS_KEY, ROLES_KEY } from "../src/common/auth/auth.decorators";
import { PermissionsGuard } from "../src/common/auth/permissions.guard";
import { CaseStatuses } from "../src/cases/case.constants";
import { SpocController } from "../src/spoc/spoc.controller";
import { currentOwner } from "../src/spoc/spoc-case-records.service";
import { holderOf, statusesHeldBy } from "../src/spoc/spoc-holder";
import { assertSafeRoleCombination } from "../src/users/role-combination";
import { SpocVendorsController } from "../src/vendor-requests/spoc-vendors.controller";

function actor(roles: string[], extra: Partial<Actor> = {}): Actor {
  return {
    userId: 11n,
    userPublicId: "00000000-0000-4000-8000-000000000011",
    tenantId: 7n,
    tenantPublicId: "00000000-0000-4000-8000-000000000007",
    tenantName: "Sapling Global",
    email: "spoc@sapling.example",
    displayName: "SPOC",
    mustChangePassword: false,
    roles,
    permissions: ["dashboard:read", "notification:read"],
    ...extra,
  };
}

function guardFor(user: Actor) {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === ROLES_KEY
        ? Reflect.getMetadata(ROLES_KEY, SpocController)
        : key === PERMISSIONS_KEY
          ? Reflect.getMetadata(PERMISSIONS_KEY, SpocController)
          : undefined,
  } as unknown as Reflector;
  const context = {
    getHandler: () => context,
    getClass: () => SpocController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return () => new PermissionsGuard(reflector).canActivate(context);
}

void test("/spoc is limited to SPOC_RM and PLATFORM_ADMIN with dashboard:read", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, SpocController), [
    "PLATFORM_ADMIN",
    "SPOC_RM",
  ]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, SpocController), [
    "dashboard:read",
  ]);
  assert.equal(guardFor(actor(["SPOC_RM"]))(), true);
  for (const role of [
    "OPS_MANAGER",
    "VERIFIER",
    "CLIENT_ADMIN",
    "FINANCE_MANAGER",
  ]) {
    assert.throws(
      guardFor(actor([role], { permissions: ["*"] })),
      ForbiddenException,
    );
  }
});

void test("every /spoc handler is a read-only GET", () => {
  const handlers = Object.getOwnPropertyNames(SpocController.prototype).filter(
    (name) => name !== "constructor",
  );
  assert.ok(handlers.length >= 12);
  for (const name of handlers) {
    const method = Reflect.getMetadata(
      METHOD_METADATA,
      (SpocController.prototype as unknown as Record<string, object>)[name]!,
    ) as RequestMethod;
    assert.equal(method, RequestMethod.GET, `${name} must be GET`);
  }
});

void test("SPOC_RM migrations grant no write permission except vendor assignment", () => {
  const read = (name: string) =>
    readFileSync(
      join(__dirname, `../prisma/migrations/${name}/migration.sql`),
      "utf8",
    );
  const original = JSON.parse(
    /'(\[[^']*\])'/.exec(read("20260925120000_spoc_rm_role"))![1]!,
  ) as string[];
  assert.deepEqual(original, ["dashboard:read", "notification:read"]);
  const granted = JSON.parse(
    /SET \[permissionsJson\] = '(\[[^']*\])'[^;]*WHERE \[code\] = 'SPOC_RM'/.exec(
      read("20260928100000_vendor_assignments"),
    )![1]!,
  ) as string[];
  assert.deepEqual(granted, [
    "dashboard:read",
    "notification:read",
    "vendor:assign",
  ]);
  assert.ok(
    granted.every(
      (permission) =>
        !/:(write|create|transition|manage|generate|review)$/.test(permission),
    ),
  );
});

void test("an RM may also hold another working role, but never Ops Manager", () => {
  assert.throws(
    () => assertSafeRoleCombination(["SPOC_RM", "OPS_MANAGER"], true),
    ConflictException,
  );
  assert.doesNotThrow(() => assertSafeRoleCombination(["SPOC_RM"]));
  assert.doesNotThrow(() =>
    assertSafeRoleCombination(["SPOC_RM", "DATA_ENTRY"], true),
  );
  assert.throws(
    () => assertSafeRoleCombination(["SPOC_RM", "DATA_ENTRY"], false),
    ConflictException,
  );
});

void test("every case status maps to exactly one holder role", () => {
  for (const status of CaseStatuses) assert.ok(holderOf(status));
  assert.deepEqual(statusesHeldBy("QA_REVIEWER"), ["QA_REVIEW"]);
  assert.deepEqual(statusesHeldBy("FINANCE_MANAGER"), ["PAYMENT_PENDING"]);
  assert.equal(holderOf("COMPLETED"), "NONE");
});

void test("current owner follows the role that holds the case", () => {
  const base = {
    client: { displayName: "Acme" },
    assignedOpsUser: { displayName: "Ops One" },
    qaReviewer: null,
    checks: [
      { tasks: [{ status: "IN_PROGRESS", assignee: { displayName: "Vera" } }] },
      { tasks: [{ status: "COMPLETED", assignee: { displayName: "Old" } }] },
    ],
    fieldVisits: [{ status: "ASSIGNED", assignee: { displayName: "Fiona" } }],
  };
  assert.equal(currentOwner({ ...base, status: "IN_PROGRESS" }), "Vera, Fiona");
  assert.equal(currentOwner({ ...base, status: "QA_REVIEW" }), "Unclaimed");
  assert.equal(currentOwner({ ...base, status: "MANAGER_REVIEW" }), "Ops One");
  assert.equal(currentOwner({ ...base, status: "DOCUMENT_PENDING" }), "Acme");
  assert.equal(currentOwner({ ...base, status: "COMPLETED" }), null);
});

void test("the only SPOC_RM write handlers are vendor assign, re-assign and re-upload", () => {
  const prototype = SpocVendorsController.prototype as unknown as Record<
    string,
    object
  >;
  const writes = Object.getOwnPropertyNames(prototype).filter(
    (name) =>
      name !== "constructor" &&
      Reflect.getMetadata(METHOD_METADATA, prototype[name]!) !==
        RequestMethod.GET,
  );
  assert.deepEqual(writes.sort(), ["assign", "reassign", "requestReupload"]);
});

/**
 * Outside /spoc, the responsible RM may use exactly these handlers: the role-gated v2
 * workflow actions (each re-checks case ownership) and read-only case evidence.
 */
const RM_ALLOWED_HANDLERS = new Set([
  // The standard colour matrix and the proof on the RM's own cases (final review).
  "WorkflowController.colourMatrix",
  "CheckEvidenceController",
  "CheckEvidenceController.constructor",
  "CheckEvidenceController.list",
  "CheckEvidenceController.upload",
  "CheckEvidenceController.caption",
  "CheckEvidenceController.remove",
  "CheckEvidenceController.file",
  // Draft report preview (client copy) and report header details on the RM's cases.
  "ReportPreviewController",
  "ReportPreviewController.constructor",
  "ReportPreviewController.reportPreview",
  "ReportPreviewController.reportView",
  "ReportPreviewController.reportDetails",
  "ReportPreviewController.updateReportDetails",
  // The RM rebuilds its case's approved report PDF (audited, reason required) and
  // downloads the released PDF (same release rules as the client).
  "ReportPreviewController.regenerateReport",
  "ReportPreviewController.releasedReportPdf",
  "WorkflowController.listDepartments",
  "WorkflowController.rmQueue",
  "WorkflowController.assignDataEntry",
  "WorkflowController.sendBack",
  "WorkflowController.routingPlan",
  "WorkflowController.route",
  "WorkflowController.finalReviewOverview",
  "WorkflowController.decideFinalReview",
  "WorkflowController.stopCase",
  "WorkflowController.resumeCase",
  "CasesController.get",
  "ClarificationsController.list",
  "DocumentsController.download",
  "DocumentsController.preview",
  // Self sign-up onboarding: the RM sees its companies and may message the client;
  // review, packages, approval and rejection are Operations Manager only (service check).
  "OpsOnboardingController",
  "OpsOnboardingController.constructor",
  // Client discounts: an RM sees and sets its own clients' discount, capped by the
  // package limit Operations sets (service check).
  // Read-only sidebar counts of the RM's own cases (service branch for SPOC_RM).
  "DashboardsController.navigation",
  // Read-only check-wise initiation form definitions.
  "WorkflowController.initiationForms",
  "ClientPricingController",
  "ClientPricingController.constructor",
  // Monthly billing: the RM sees its companies' dues and sends a payment reminder
  // (service limits it to the RM's own companies; audited).
  "RmPaymentsController",
  "RmPaymentsController.constructor",
  "RmPaymentsController.list",
  "RmPaymentsController.remind",
  // RM finance on its own companies: record a payment received and download the
  // invoice (service checks the company is the RM's; audited, Finance is notified),
  // and the company's preset MIS (same check; exports audited).
  "RmPaymentsController.recordPayment",
  "RmPaymentsController.invoicePdf",
  "RmClientMisController",
  "RmClientMisController.constructor",
  "RmClientMisController.clients",
  "RmClientMisController.mis",
  "RmClientMisController.misExport",
  // Vendor check work: an RM sends its own cases' checks to a vendor and reviews the
  // result (service checks case ownership; audited).
  "VendorChecksController",
  "VendorChecksController.constructor",
  "VendorChecksController.forCheck",
  "VendorChecksController.assign",
  "VendorChecksController.review",
  "VendorChecksController.cancel",
  "VendorChecksController.board",
  "VendorChecksController.export",
  "VendorChecksController.evidence",
]);

void test("SPOC_RM is allowed only on /spoc, vendor assignment and the reviewed RM workflow handlers", async () => {
  const files: string[] = [];
  const walk = (dir: string) =>
    readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".controller.ts")) files.push(path);
    });
  walk(join(__dirname, "../src"));
  let checked = 0;
  for (const file of files) {
    const exported = (await import(pathToFileURL(file).href)) as Record<
      string,
      unknown
    >;
    for (const value of Object.values(exported)) {
      if (
        typeof value !== "function" ||
        value === SpocController ||
        value === SpocVendorsController
      )
        continue;
      const targets: Array<[string, unknown]> = [
        [`${value.name}`, value],
        ...Object.getOwnPropertyNames(value.prototype ?? {}).map(
          (name): [string, unknown] => [
            `${value.name}.${name}`,
            (value.prototype as Record<string, unknown>)[name],
          ],
        ),
      ];
      for (const [name, target] of targets) {
        if (typeof target !== "function") continue;
        const roles = Reflect.getMetadata(ROLES_KEY, target) as
          string[] | undefined;
        if (roles) checked += 1;
        assert.ok(
          !roles?.includes("SPOC_RM") || RM_ALLOWED_HANDLERS.has(name),
          `${file} (${name}) must not allow SPOC_RM`,
        );
      }
    }
  }
  assert.ok(checked > 50, "role metadata was actually inspected");
});

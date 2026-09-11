import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ConflictException,
  ForbiddenException,
  type ExecutionContext,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { caseAccessScope } from "../src/common/auth/access-scope";
import type { Actor } from "../src/common/auth/actor";
import { PERMISSIONS_KEY, ROLES_KEY } from "../src/common/auth/auth.decorators";
import { PermissionsGuard } from "../src/common/auth/permissions.guard";
import { userDirectoryBranchScope } from "../src/users/users.service";
import { presentCaseDetail } from "../src/cases/case.presenter";
import { presentFieldExceptions } from "../src/dashboards/dashboards.service";
import {
  assertDocumentUploadAllowed,
  DOCUMENT_UPLOAD_ALLOWED_CASE_STATUSES,
} from "../src/documents/documents.service";
import { mergeFieldVisitQueue } from "../src/field-visits/field-visits.service";

function actor(roles: string[], extra: Partial<Actor> = {}): Actor {
  return {
    userId: 11n,
    userPublicId: "00000000-0000-4000-8000-000000000011",
    tenantId: 7n,
    tenantPublicId: "00000000-0000-4000-8000-000000000007",
    tenantName: "Sapling Global",
    email: "user@sapling.example",
    displayName: "User",
    mustChangePassword: false,
    roles,
    permissions: ["*"],
    ...extra,
  };
}

void test("branch-scoped operations sees its branch and unassigned intake only", () => {
  assert.deepEqual(caseAccessScope(actor(["OPS_MANAGER"], { branchId: 23n })), {
    tenantId: 7n,
    OR: [{ branchId: 23n }, { branchId: null }],
  });
});

void test("platform administrators remain tenant-wide despite a profile branch", () => {
  assert.deepEqual(
    caseAccessScope(
      actor(["PLATFORM_ADMIN"], { branchId: 23n, clientId: 31n }),
    ),
    { tenantId: 7n },
  );
});

void test("user directory is tenant-wide for platform admin and branch-bound for ops", () => {
  assert.deepEqual(
    userDirectoryBranchScope(actor(["PLATFORM_ADMIN"], { branchId: 23n })),
    {},
  );
  assert.deepEqual(
    userDirectoryBranchScope(actor(["OPS_MANAGER"], { branchId: 23n })),
    { branchId: 23n },
  );
});

void test("verifier and field case scopes require their assignments", () => {
  assert.deepEqual(caseAccessScope(actor(["VERIFIER"])), {
    tenantId: 7n,
    checks: { some: { tasks: { some: { assigneeId: 11n } } } },
  });
  assert.deepEqual(caseAccessScope(actor(["FIELD_EXECUTIVE"])), {
    tenantId: 7n,
    fieldVisits: { some: { assigneeId: 11n } },
  });
});

void test("QA case scope is limited to the assigned reviewer", () => {
  assert.deepEqual(caseAccessScope(actor(["QA_REVIEWER"])), {
    tenantId: 7n,
    qaReviewerId: 11n,
  });
});

void test("wildcard permission cannot bypass endpoint role restrictions", () => {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === ROLES_KEY
        ? ["PLATFORM_ADMIN", "OPS_MANAGER"]
        : key === PERMISSIONS_KEY
          ? ["dashboard:read"]
          : undefined,
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);
  const context = {
    getHandler: () => context,
    getClass: () => PermissionsGuard,
    switchToHttp: () => ({
      getRequest: () => ({ user: actor(["FIELD_EXECUTIVE"]) }),
    }),
  } as unknown as ExecutionContext;
  assert.throws(() => guard.canActivate(context), ForbiddenException);
});

void test("field and verifier case projections omit unrelated protected data", () => {
  const row = {
    publicId: "case-1",
    subject: {
      publicId: "subject-1",
      fullName: "Candidate",
      email: "secret@example.test",
    },
    client: { publicId: "client-1" },
    checks: [
      {
        publicId: "check-1",
        findings: [{ source: "private" }],
        tasks: [
          {
            publicId: "task-1",
            assignee: { publicId: "verifier-1", email: "v@example.test" },
          },
        ],
      },
    ],
    documents: [{ versions: [{ originalName: "secret.pdf", sha256: "hash" }] }],
    qaReviews: [{ notes: "private", checklistJson: "[]" }],
    reports: [{ publicId: "report-1" }],
    fieldVisits: [
      {
        publicId: "visit-1",
        assignee: { publicId: "field-1", email: "f@example.test" },
        evidence: [{ publicId: "evidence-1", sha256: "hash" }],
      },
    ],
  };
  const field = presentCaseDetail(
    row,
    actor(["FIELD_EXECUTIVE"], { userPublicId: "field-1" }),
  );
  assert.deepEqual(field.documents, []);
  assert.ok("checks" in field);
  assert.deepEqual(field.checks, []);
  assert.equal(JSON.stringify(field).includes("sha256"), false);
  const verifier = presentCaseDetail(
    row,
    actor(["VERIFIER"], { userPublicId: "verifier-1" }),
  );
  assert.deepEqual(verifier.documents, []);
  assert.deepEqual(verifier.qaReviews, []);
  assert.equal(JSON.stringify(verifier).includes("v@example.test"), false);
});

void test("client case projection preserves safe drawer array contracts", () => {
  const result = presentCaseDetail(
    {
      publicId: "case-1",
      subject: { publicId: "subject-1", fullName: "Candidate" },
      checks: [],
      fieldVisits: [],
      statusHistory: [{ toStatus: "IN_PROGRESS" }],
      documents: [
        { publicId: "document-1", versions: [{ originalName: "private.pdf" }] },
      ],
    },
    actor(["CLIENT_ADMIN"], { clientId: 31n }),
  );
  assert.equal(Array.isArray(result.statusHistory), true);
  assert.ok(Array.isArray(result.documents));
  const document: unknown = result.documents[0];
  assert.ok(document && typeof document === "object" && "versions" in document);
  assert.deepEqual(document.versions, []);
});

void test("client exception projection never exposes field location metadata", () => {
  const result = presentFieldExceptions(
    actor(["CLIENT_ADMIN"], { clientId: 31n }),
    [
      {
        publicId: "visit-1",
        address: "private",
        distanceMeters: 12,
        capturedAt: new Date(),
      },
    ],
  );
  assert.deepEqual(result, []);
});

void test("document uploads are limited to evidence-collection workflow states", () => {
  assert.deepEqual(
    [...DOCUMENT_UPLOAD_ALLOWED_CASE_STATUSES],
    [
      "DRAFT",
      "CONSENT_PENDING",
      "DOCUMENT_PENDING",
      "IN_PROGRESS",
      "CLARIFICATION_PENDING",
    ],
  );
  assert.doesNotThrow(() =>
    assertDocumentUploadAllowed("CLARIFICATION_PENDING"),
  );
  for (const status of ["QA_REVIEW", "COMPLETED", "CLOSED", "CANCELLED"]) {
    assert.throws(() => assertDocumentUploadAllowed(status), ConflictException);
  }
});

void test("field queue always places every active assignment before bounded history", () => {
  const active = [{ id: "new-assignment", status: "ASSIGNED" }];
  const history = Array.from({ length: 30 }, (_, index) => ({
    id: `completed-${index}`,
    status: "COMPLETED",
  }));
  const result = mergeFieldVisitQueue(active, history);
  assert.equal(result[0]?.id, "new-assignment");
  assert.equal(result.filter((visit) => visit.status === "ASSIGNED").length, 1);
  assert.equal(result.length, 31);
});

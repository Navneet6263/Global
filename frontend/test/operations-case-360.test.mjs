import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function transpile(relPath, mocks = {}) {
  const modules = new Map();
  function load(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const exports = {};
    modules.set(url.href, exports);
    const code = ts.transpileModule(readFileSync(url, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = (id) => {
      if (id in mocks) return mocks[id];
      if (id.startsWith("./")) {
        try {
          return load(new URL(`${id}.ts`, url));
        } catch {
          return load(new URL(`${id}.tsx`, url));
        }
      }
      throw new Error(`Unmocked import ${id} from ${url.href}`);
    };
    new Function("require", "exports", code)(require, exports);
    return exports;
  }
  return load(new URL(relPath, import.meta.url));
}

function loadOperationsMappers() {
  return transpile("../src/features/operations/repositories/api-operations-mappers.ts", {
    "@/features/cases/case-workflow-summary": { caseWorkflowSummary: () => undefined },
    "@/lib/backend-api/case-services": { casePackageName: () => "Standard BGV" },
    "@/lib/contracts/check": {
      normalizeCheckType: (type) => String(type).toLowerCase(),
      checkLabel: (type) => String(type),
    },
  });
}

test("clarificationState maps L2 lifecycle statuses accurately", () => {
  const mappers = loadOperationsMappers();
  assert.equal(mappers.clarificationState("CANDIDATE_SUBMITTED"), "response_received");
  assert.equal(mappers.clarificationState("DATA_ENTRY_PENDING"), "under_review");
  assert.equal(mappers.clarificationState("UNDER_REVIEW"), "under_review");
  assert.equal(mappers.clarificationState("ANSWERED"), "response_received");
  assert.equal(mappers.clarificationState("RESPONDED"), "response_received");
  assert.equal(mappers.clarificationState("RESPONSE_RECEIVED"), "response_received");
  assert.equal(mappers.clarificationState("RESOLVED"), "resolved");
  assert.equal(mappers.clarificationState("OPEN"), "awaiting_client");
  assert.equal(mappers.clarificationState("EXPIRED"), "awaiting_client");
});

test("detailCase maps L2 clarifications and documents cleanly", () => {
  const mappers = loadOperationsMappers();
  const detail = mappers.detailCase({
    id: "case-l2",
    caseNumber: "SG-20261111-0727E3",
    externalRef: null,
    status: "CLARIFICATION_PENDING",
    priority: "NORMAL",
    dueAt: null,
    completedAt: null,
    riskLevel: "LOW",
    version: 3,
    createdAt: "2026-11-11T10:00:00.000Z",
    updatedAt: "2026-11-11T10:30:00.000Z",
    subject: { publicId: "sub-1", fullName: "Nikhil Ranjan" },
    client: { publicId: "cli-1", code: "SG", displayName: "Sapling Global" },
    branch: null,
    assignedOpsUser: { publicId: "ops-1", displayName: "Ashish" },
    checks: [],
    fieldVisits: [],
    consents: [],
    reports: [],
    statusHistory: [],
    qaReviews: [],
    documents: [
      {
        publicId: "doc-1",
        type: "ADDRESS_PROOF",
        status: "VERIFIED",
        currentVersion: 2,
        expiresAt: null,
        version: 2,
        reviewNote: null,
        reviewedAt: null,
        versions: [
          {
            version: 2,
            originalName: "addr-v2.pdf",
            contentType: "application/pdf",
            sizeBytes: "2048",
            sha256: "a".repeat(64),
            malwareState: "CLEAN",
            reviewStatus: "PENDING",
            reviewNote: null,
            reviewedAt: null,
            clarificationId: "c1",
            createdAt: "2026-11-11T10:20:00.000Z",
          },
        ],
      },
    ],
    clarifications: [
      {
        publicId: "c1",
        level: "L2",
        status: "CANDIDATE_SUBMITTED",
        subject: "Address proof resubmission",
        dueAt: null,
        resolvedAt: null,
        createdAt: "2026-11-11T10:15:00.000Z",
      },
      {
        publicId: "c2",
        level: "L2",
        status: "DATA_ENTRY_PENDING",
        subject: "Employment proof re-entry",
        dueAt: null,
        resolvedAt: null,
        createdAt: "2026-11-11T10:16:00.000Z",
      },
    ],
  });

  assert.deepEqual(
    detail.clarifications.map((item) => item.state),
    ["response_received", "under_review"],
  );
  assert.equal(detail.documents[0].originalName, "addr-v2.pdf");
  assert.equal(detail.documents[0].available, true);
});

test("operationsApi.getCase returns null on 404 and rethrows 500 server errors", async () => {
  class StubApiError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
      this.problem = { status, detail: message };
    }
  }
  let nextError = null;
  const repo = transpile("../src/features/operations/repositories/api-operations.repository.ts", {
    "./operations-repository": {},
    "./api-operations-assignments": {},
    "./api-operations-dashboard": {},
    "./api-operations-exceptions": {},
    "./api-operations-insights": {},
    "./api-operations-register": {},
    "./api-operations-team": {},
    "./api-operations-mappers": loadOperationsMappers(),
    "@/lib/backend-api/cases": {
      getCase: async () => {
        throw nextError;
      },
      listAllClients: async () => [],
    },
    "@/lib/backend-api/clarifications": { resolveClarification: async () => ({}) },
    "@/lib/backend-api/client": { ApiError: StubApiError },
    "@/lib/backend-api/dashboards": {
      getExceptionsDashboard: async () => ({ clarifications: [] }),
    },
    "@/lib/backend-api/notifications": {
      listNotifications: async () => ({ items: [] }),
      markAllNotificationsRead: async () => ({}),
      markNotificationRead: async () => ({}),
    },
    "@/lib/backend-api/users": { listAllUsers: async () => ({ items: [] }) },
  });
  const api = repo.createApiOperationsRepository();

  nextError = new StubApiError(404, "Not found");
  assert.equal(await api.getCase("missing-case"), null);

  nextError = new StubApiError(500, "An unexpected error occurred");
  await assert.rejects(() => api.getCase("broken-case"), { status: 500 });
});

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

test("L2 document options, file validation and rejection reason enforce bounds", () => {
  const types = transpile("../src/lib/backend-api/clarifications-l2-types.ts");
  assert.deepEqual(types.allowedDocumentTypesForCheck("EMPLOYMENT"), [
    "EMPLOYMENT_PROOF",
    "AADHAAR",
    "PAN",
    "OTHER",
  ]);
  assert.deepEqual(types.allowedDocumentTypesForCheck(" address "), [
    "ADDRESS_PROOF",
    "AADHAAR",
    "PAN",
    "OTHER",
  ]);
  assert.deepEqual(types.allowedDocumentTypesForCheck(null), ["AADHAAR", "PAN", "OTHER"]);

  assert.equal(types.validateCandidateL2File({ type: "application/pdf", size: 1024 }), null);
  assert.equal(
    types.validateCandidateL2File({ type: "image/jpeg", size: types.L2_MAX_UPLOAD_BYTES }),
    null,
  );
  assert.equal(types.validateCandidateL2File({ type: "image/png", size: 1 }), null);
  assert.match(types.validateCandidateL2File({ type: "image/gif", size: 100 }), /PDF, JPEG or PNG/);
  assert.match(types.validateCandidateL2File({ type: "application/pdf", size: 0 }), /empty/);
  assert.match(
    types.validateCandidateL2File({ type: "application/pdf", size: types.L2_MAX_UPLOAD_BYTES + 1 }),
    /10 MB/,
  );

  assert.match(types.validateRejectionReason("    "), /at least 5/);
  assert.match(types.validateRejectionReason("fix"), /at least 5/);
  assert.equal(types.validateRejectionReason("Blurry"), null);
  assert.equal(types.validateRejectionReason("a".repeat(1000)), null);
  assert.match(types.validateRejectionReason("a".repeat(1001)), /exceed 1000/);
});

test("candidate utility helpers cover document metadata, validation and L2 stage labels", () => {
  const utils = transpile("../src/components/candidate/candidate-utils.ts");
  assert.equal(utils.docMeta("EDUCATION_CERTIFICATE").label, "Education certificate");
  assert.equal(utils.docMeta("CUSTOM_DOC").label, "custom doc");
  assert.equal(utils.validateCandidateFile({ type: "application/pdf", size: 512 }), "");
  assert.match(utils.validateCandidateFile({ type: "text/plain", size: 512 }), /PDF, JPG or PNG/);
  assert.match(utils.l2StageNote("CANDIDATE_SUBMITTED"), /Operations team is reviewing/);
  assert.match(utils.l2StageNote("DATA_ENTRY_PENDING"), /Data Entry team is updating/);
  assert.match(utils.l2StageNote("RESOLVED"), /Completed/);
  assert.equal(utils.l2StageNote("OPEN"), null);
});

test("version-aware document download and preview pass optional ?version=N query", async () => {
  const downloads = [];
  const saved = [];
  const docs = transpile("../src/lib/backend-api/documents.ts", {
    "./client": {
      apiDownload: async (path) => {
        downloads.push(path);
        return new Blob(["pdf"], { type: "application/pdf" });
      },
      apiRequest: async () => ({}),
      saveBlob: (_blob, filename) => saved.push(filename),
    },
    "./file-digest": { fileSha256: async () => "0".repeat(64) },
    "./document-preview": { openDocumentPreview: async (loader) => loader() },
  });

  await docs.downloadDocument("doc-9", "pan-v2.pdf", 2);
  await docs.downloadDocument("doc-9", "pan.pdf");
  await docs.previewDocument("doc-9", 3);
  await docs.previewDocument("doc-9");

  assert.deepEqual(downloads, [
    "/documents/doc-9/content?version=2",
    "/documents/doc-9/content",
    "/documents/doc-9/preview?version=3",
    "/documents/doc-9/preview",
  ]);
  assert.deepEqual(saved, ["pan-v2.pdf", "pan.pdf"]);
});

test("L2 clarification client endpoints send exact paths, payloads and multipart XHR headers", async () => {
  const calls = [];
  class MockApiError extends Error {
    constructor(problem) {
      super(problem.title || "ApiError");
      this.problem = problem;
    }
  }
  const l2 = transpile("../src/lib/backend-api/clarifications-l2.ts", {
    "@/config/api": { API_BASE_URL: "https://test.invalid/api/v1" },
    "./client": {
      ApiError: MockApiError,
      apiRequest: async (path, init) => {
        calls.push({ path, init });
        return { ok: true };
      },
    },
    "./file-digest": { fileSha256: async () => "f".repeat(64) },
    "./request-activity": { beginRequestActivity: () => () => {} },
  });

  await l2.getOpsL2Clarifications({ status: "CANDIDATE_SUBMITTED", search: "SG-1", limit: 20 });
  await l2.completeOpsClarification("clar-1", { dataEntryUserId: "de-1", note: "Checked" });
  await l2.getReentryClarifications({ search: "Asha", limit: 15 });
  await l2.getReentryClarificationDetail("clar-1");
  await l2.rejectL2Document("clar-1", { reason: "Blurry scan", documentVersion: 2 });
  await l2.completeL2Reentry("clar-1", { documentVersion: 3, note: "Done", entries: [{ a: "b" }] });

  assert.equal(
    calls[0].path,
    "/clarifications/l2/ops-queue?status=CANDIDATE_SUBMITTED&search=SG-1&limit=20",
  );
  assert.equal(calls[1].path, "/clarifications/clar-1/ops-complete");
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[2].path, "/workflow/clarifications/reentry?search=Asha&limit=15");
  assert.equal(calls[3].path, "/workflow/clarifications/clar-1");
  assert.equal(calls[4].path, "/workflow/clarifications/clar-1/reject-document");
  assert.equal(calls[5].path, "/workflow/clarifications/clar-1/complete-reentry");

  const prevXhr = globalThis.XMLHttpRequest;
  let capturedXhr = null;
  globalThis.XMLHttpRequest = class {
    constructor() {
      this.headers = {};
      this.upload = {};
      capturedXhr = this;
    }
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(k, v) {
      this.headers[k] = v;
    }
    send(body) {
      this.body = body;
      this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
      this.status = 200;
      this.responseText = JSON.stringify({
        clarificationId: "clar-1",
        submittedDocumentVersion: 2,
      });
      this.onload?.();
    }
  };

  try {
    const progress = [];
    const file = new File([Buffer.from("%PDF-1.4")], "corrected.pdf", { type: "application/pdf" });
    const res = await l2.submitCandidateL2Clarification({
      accessId: "acc-1",
      token: "tok-1",
      clarificationId: "clar-1",
      file,
      message: "Updated clear document.",
      documentType: "EMPLOYMENT_PROOF",
      noticeVersion: "1",
      onProgress: (p) => progress.push(p),
    });
    assert.equal(res.submittedDocumentVersion, 2);
    assert.equal(capturedXhr.method, "POST");
    assert.equal(
      capturedXhr.url,
      "https://test.invalid/api/v1/public/candidate-access/acc-1/clarifications/clar-1/submit",
    );
    assert.equal(capturedXhr.headers["x-portal-token"], "tok-1");
    assert.equal(capturedXhr.headers["x-content-sha256"], "f".repeat(64));
    assert.ok(capturedXhr.headers["idempotency-key"]);
    assert.deepEqual(progress, [50, 100]);
  } finally {
    globalThis.XMLHttpRequest = prevXhr;
  }
});

test("frontend L2 API contracts match backend controller routes and all Phase 4 source files stay below 300 lines", () => {
  const clarCtrl = readFileSync(
    new URL("../../backend/src/clarifications/clarifications.controller.ts", import.meta.url),
    "utf8",
  );
  const wfCtrl = readFileSync(
    new URL("../../backend/src/workflow/workflow-clarifications.controller.ts", import.meta.url),
    "utf8",
  );
  const candCtrl = readFileSync(
    new URL("../../backend/src/candidate-portal/candidate-portal.controller.ts", import.meta.url),
    "utf8",
  );
  const docsCtrl = readFileSync(
    new URL("../../backend/src/documents/documents.controller.ts", import.meta.url),
    "utf8",
  );

  assert.match(clarCtrl, /@Get\("clarifications\/l2\/ops-queue"\)/);
  assert.match(clarCtrl, /@Post\("clarifications\/:clarificationId\/ops-complete"\)/);
  assert.match(clarCtrl, /@Get\("clarifications\/l1-queue"\)/);
  assert.match(clarCtrl, /@Get\("workflow\/clarifications\/rm-l1-queue"\)/);
  assert.match(clarCtrl, /@Get\("workflow\/clarifications\/rm-l2-queue"\)/);
  assert.match(clarCtrl, /@Post\("workflow\/clarifications\/:clarificationId\/rm-handoff"\)/);
  assert.match(
    clarCtrl,
    /@Patch\("workflow\/cases\/:caseId\/clarifications\/:clarificationId\/rm-resolve"\)/,
  );
  assert.match(wfCtrl, /@Controller\("workflow\/clarifications"\)/);
  assert.match(wfCtrl, /@Get\("reentry"\)/);
  assert.match(wfCtrl, /@Get\(":clarificationId"\)/);
  assert.match(wfCtrl, /@Post\(":clarificationId\/reject-document"\)/);
  assert.match(wfCtrl, /@Post\(":clarificationId\/complete-reentry"\)/);
  assert.match(
    candCtrl,
    /"public\/candidate-access\/:accessId\/clarifications\/:clarificationId\/submit"/,
  );
  assert.match(docsCtrl, /@Query\("version"/);

  const phase4Files = [
    "../src/lib/backend-api/clarifications-l2-types.ts",
    "../src/lib/backend-api/clarifications-l2.ts",
    "../src/lib/backend-api/clarifications.ts",
    "../src/lib/backend-api/candidate-portal.ts",
    "../src/lib/backend-api/tasks.ts",
    "../src/lib/backend-api/documents.ts",
    "../src/features/cases/document-file-actions.tsx",
    "../src/features/cases/ClarificationDocumentSection.tsx",
    "../src/features/delivery/verifier/VerifierRaiseInsufficiencyForm.tsx",
    "../src/features/delivery/verifier/VerifierL2Clarifications.tsx",
    "../src/features/delivery/verifier/VerifierContextViews.tsx",
    "../src/features/delivery/verifier/VerifierTaskDesk.tsx",
    "../src/features/delivery/verifier/VerifierDocumentsView.tsx",
    "../src/features/delivery/verifier/VerifierQueue.tsx",
    "../src/components/candidate/candidate-utils.ts",
    "../src/components/candidate/CandidateDocumentRow.tsx",
    "../src/components/candidate/CandidateL2Messages.tsx",
    "../src/components/candidate/CandidateL2ClarificationCard.tsx",
    "../src/components/candidate/CandidateChecks.tsx",
    "../src/components/candidate/CandidateUploadPage.tsx",
    "../src/features/operations/components/OpsL2ClarificationsPanel.tsx",
    "../src/routes/operations.clarifications.tsx",
    "../src/lib/backend-api/clarifications-shared.ts",
    "../src/features/clarifications/SharedL2ClarificationRow.tsx",
    "../src/features/clarifications/SharedL2ClarificationsPanel.tsx",
    "../src/features/clarifications/SharedL1ClarificationRow.tsx",
    "../src/features/clarifications/SharedL1ClarificationsPanel.tsx",
    "../src/features/workflow-ui/RmCorrectionsWorkspace.tsx",
    "../src/features/workflow-ui/RmQueueOverview.tsx",
    "../src/features/workflow-ui/RmQueueRail.tsx",
    "../src/features/workflow-ui/RmQueueRow.tsx",
    "../src/features/workflow-ui/RmQueueTableSection.tsx",
    "../src/features/workflow-ui/RmWorkQueue.tsx",
    "../src/lib/backend-api/data-entry-queue.ts",
    "../src/features/workflow-ui/DataEntryL2RejectBox.tsx",
    "../src/features/workflow-ui/DataEntryL2EntriesForm.tsx",
    "../src/features/workflow-ui/DataEntryL2ReentryDrawer.tsx",
    "../src/features/workflow-ui/DataEntryWorkspace.tsx",
    "../src/features/workflow-ui/DataEntryQueueRow.tsx",
    "../src/features/workflow-ui/DataEntryIntakeReview.tsx",
    "../src/features/workflow-ui/DataEntryReviewBody.tsx",
    "../src/features/workflow-ui/DataEntryReviewSidebar.tsx",
    "../src/features/workflow-ui/DataEntryReviewRows.tsx",
    "../src/routes/data-entry.index.tsx",
  ];
  for (const rel of phase4Files) {
    const lines = readFileSync(new URL(rel, import.meta.url), "utf8").split("\n").length;
    assert.ok(lines < 300, `${rel} has ${lines} lines (>= 300)`);
  }
});

import { expect, request, test, type APIRequestContext, type APIResponse } from "@playwright/test";

const enabled = process.env.E2E_GOLDEN_FLOW === "true";
const credentials = {
  tenantCode: process.env.E2E_TENANT_CODE,
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};
const runId = process.env.E2E_GOLDEN_RUN_ID?.toLowerCase();
const apiUrl = `${(process.env.E2E_API_URL ?? "http://127.0.0.1:4100/api/v1").replace(/\/+$/, "")}/`;
const browserOrigin = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const verifierTemporaryPassword = "Managed!Password2026";
const verifierPassword = "Verified!Flow2026";

test("case lifecycle reaches a verified report through real APIs", async () => {
  test.setTimeout(360_000);
  test.skip(!enabled, "Set E2E_GOLDEN_FLOW=true to run managed write-path verification");
  if (!credentials.tenantCode || !credentials.email || !credentials.password) {
    throw new Error("E2E tenant and administrator credentials are required");
  }
  if (!runId || !/^[a-z0-9]{6,20}$/.test(runId)) {
    throw new Error("E2E_GOLDEN_RUN_ID must contain 6-20 lowercase letters or digits");
  }

  const api = await request.newContext({
    baseURL: apiUrl,
    extraHTTPHeaders: { origin: browserOrigin },
  });
  let verifierApi: APIRequestContext | undefined;
  let keyIndex = 0;
  const writeHeaders = () => ({
    "idempotency-key": `gf:${runId}:${String(++keyIndex).padStart(4, "0")}`,
  });

  try {
    await expectJson(await api.post("auth/login", { data: credentials }), 201);

    const managedUser = await expectJson<{
      id: string;
      status: string;
      version: number;
    }>(
      await api.post("users", {
        headers: writeHeaders(),
        data: {
          email: `managed-${runId}@e2e.invalid`,
          displayName: "Golden flow managed user",
          roleCodes: ["VERIFIER"],
          temporaryPassword: verifierTemporaryPassword,
        },
      }),
      201,
    );
    const suspendedUser = await expectJson<{
      status: string;
      version: number;
    }>(
      await api.patch(`users/${managedUser.id}`, {
        headers: writeHeaders(),
        data: { status: "SUSPENDED", version: managedUser.version },
      }),
      200,
    );
    expect(suspendedUser.status).toBe("SUSPENDED");
    const userDirectory = await expectJson<{
      items: Array<{ id: string; status: string }>;
    }>(await api.get("users"), 200);
    expect(userDirectory.items).toContainEqual(
      expect.objectContaining({
        id: managedUser.id,
        status: "SUSPENDED",
      }),
    );
    const invalidClientAdmin = await api.patch(`users/${managedUser.id}`, {
      headers: writeHeaders(),
      data: {
        status: "ACTIVE",
        roleCodes: ["CLIENT_ADMIN"],
        version: suspendedUser.version,
      },
    });
    expect(invalidClientAdmin.status()).toBe(409);
    const reactivatedUser = await expectJson<{
      status: string;
      version: number;
    }>(
      await api.patch(`users/${managedUser.id}`, {
        headers: writeHeaders(),
        data: { status: "ACTIVE", version: suspendedUser.version },
      }),
      200,
    );
    expect(reactivatedUser.status).toBe("ACTIVE");

    const clientKey = writeHeaders();
    const clientInput = {
      code: `GF${runId.toUpperCase()}`,
      legalName: `Golden flow ${runId}`,
      displayName: `Golden flow ${runId}`,
      contactName: "Release verification",
      contactEmail: `release-${runId}@e2e.invalid`,
      slaHours: 48,
    };
    const client = await expectJson<{ publicId: string }>(
      await api.post("clients", { data: clientInput, headers: clientKey }),
      201,
    );
    const replay = await api.post("clients", {
      data: clientInput,
      headers: clientKey,
    });
    const replayClient = await expectJson<{ publicId: string }>(replay, 201);
    expect(replay.headers()["x-idempotent-replay"]).toBe("true");
    expect(replayClient.publicId).toBe(client.publicId);

    const createdCase = await expectJson<{ id: string; status: string }>(
      await api.post("cases", {
        headers: writeHeaders(),
        data: {
          clientId: client.publicId,
          fullName: "Golden Flow Candidate",
          email: `candidate-${runId}@e2e.invalid`,
          employeeCode: `GF-${runId}`,
          externalRef: `E2E-GOLDEN-${runId}`,
          priority: "HIGH",
          checks: ["IDENTITY"],
        },
      }),
      201,
    );
    expect(createdCase.status).toBe("CONSENT_PENDING");

    const initial = await getCase(api, createdCase.id);
    expect(initial.consents).toHaveLength(1);
    const consent = await expectJson<{
      consentId: string;
      developmentOtp?: string;
    }>(
      await api.post(`cases/${createdCase.id}/consent/request`, {
        headers: writeHeaders(),
      }),
      201,
    );
    expect(consent.developmentOtp).toMatch(/^\d{6}$/);
    await expectJson(
      await api.post(`public/consents/${consent.consentId}/confirm`, {
        data: { otp: consent.developmentOtp },
      }),
      201,
    );

    const document = await expectJson<{ id: string }>(
      await api.post(`cases/${createdCase.id}/documents`, {
        headers: writeHeaders(),
        data: { type: "PASSPORT" },
      }),
      201,
    );
    const upload = await expectJson<{ malwareState: string; sha256: string }>(
      await api.post(`documents/${document.id}/content`, {
        headers: writeHeaders(),
        multipart: {
          file: {
            name: "golden-flow-passport.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from("%PDF-1.4\n% Sapling Global release verification\n%%EOF\n"),
          },
        },
      }),
      201,
    );
    expect(upload.malwareState).toBe("CLEAN");
    expect(upload.sha256).toMatch(/^[a-f0-9]{64}$/);

    let caseDetail = await getCase(api, createdCase.id);
    expect(caseDetail.status).toBe("DOCUMENT_PENDING");
    caseDetail = await expectJson<CaseDetail>(
      await api.patch(`cases/${createdCase.id}/status`, {
        headers: writeHeaders(),
        data: { status: "IN_PROGRESS", version: caseDetail.version },
      }),
      200,
    );

    const clarification = await expectJson<{
      id: string;
      portalToken: string;
    }>(
      await api.post(`cases/${createdCase.id}/clarifications`, {
        headers: writeHeaders(),
        data: {
          checkId: caseDetail.checks[0].publicId,
          subject: "Confirm identity source",
          message: "Please confirm that the uploaded identity document is current.",
        },
      }),
      201,
    );
    await expectJson(
      await api.get(`public/clarifications/${clarification.id}`, {
        headers: { "x-portal-token": clarification.portalToken },
      }),
      200,
    );
    await expectJson(
      await api.post(`public/clarifications/${clarification.id}/respond`, {
        headers: { "x-portal-token": clarification.portalToken },
        data: { message: "The uploaded passport is current and valid." },
      }),
      201,
    );
    await expectJson(
      await api.patch(`cases/${createdCase.id}/clarifications/${clarification.id}/resolve`, {
        headers: writeHeaders(),
        data: { note: "Candidate response reviewed against the document." },
      }),
      200,
    );

    caseDetail = await getCase(api, createdCase.id);
    expect(caseDetail.status).toBe("IN_PROGRESS");
    const task = await expectJson<{ id: string; version: number }>(
      await api.post(`checks/${caseDetail.checks[0].publicId}/tasks`, {
        headers: writeHeaders(),
        data: {
          assigneeId: managedUser.id,
          instructions: "Validate identity document and record the source.",
        },
      }),
      201,
    );
    verifierApi = await request.newContext({
      baseURL: apiUrl,
      extraHTTPHeaders: { origin: browserOrigin },
    });
    const verifierCredentials = {
      tenantCode: credentials.tenantCode,
      email: `managed-${runId}@e2e.invalid`,
    };
    await expectJson(
      await verifierApi.post("auth/login", {
        data: { ...verifierCredentials, password: verifierTemporaryPassword },
      }),
      201,
    );
    await expectJson(
      await verifierApi.post("auth/change-password", {
        headers: writeHeaders(),
        data: {
          currentPassword: verifierTemporaryPassword,
          newPassword: verifierPassword,
        },
      }),
      201,
    );
    await expectJson(
      await verifierApi.post("auth/login", {
        data: { ...verifierCredentials, password: verifierPassword },
      }),
      201,
    );
    const started = await expectJson<{ version: number; status: string }>(
      await verifierApi.patch(`tasks/${task.id}`, {
        headers: writeHeaders(),
        data: { status: "IN_PROGRESS", version: task.version },
      }),
      200,
    );
    expect(started.status).toBe("IN_PROGRESS");
    const blocked = await expectJson<{ version: number; status: string }>(
      await verifierApi.patch(`tasks/${task.id}`, {
        headers: writeHeaders(),
        data: {
          status: "BLOCKED",
          version: started.version,
          sourceSummary: "Awaiting an authoritative identity-source response.",
          findings: [],
        },
      }),
      200,
    );
    expect(blocked.status).toBe("BLOCKED");
    caseDetail = await getCase(api, createdCase.id);
    expect(caseDetail.checks[0].status).toBe("BLOCKED");
    const resumed = await expectJson<{ version: number; status: string }>(
      await verifierApi.patch(`tasks/${task.id}`, {
        headers: writeHeaders(),
        data: { status: "IN_PROGRESS", version: blocked.version, findings: [] },
      }),
      200,
    );
    expect(resumed.status).toBe("IN_PROGRESS");
    await expectJson(
      await verifierApi.patch(`tasks/${task.id}`, {
        headers: writeHeaders(),
        data: {
          status: "COMPLETED",
          version: resumed.version,
          result: "CLEAR",
          sourceSummary: "Passport document inspected and identity details matched.",
          findings: [],
        },
      }),
      200,
    );

    caseDetail = await getCase(api, createdCase.id);
    expect(caseDetail.status).toBe("QA_REVIEW");
    const claim = await expectJson<{ caseVersion: number }>(
      await api.post(`qa/cases/${createdCase.id}/claim`, {
        headers: writeHeaders(),
        data: { caseVersion: caseDetail.version },
      }),
      201,
    );
    const decision = await expectJson<{
      caseStatus: string;
      caseVersion: number;
    }>(
      await api.post(`qa/cases/${createdCase.id}/decision`, {
        headers: writeHeaders(),
        data: {
          decision: "APPROVED",
          caseVersion: claim.caseVersion,
          checklist: [
            "Candidate identity and case scope verified",
            "All check results and source summaries reviewed",
            "Supporting evidence is complete and readable",
            "Discrepancies and risk ratings are consistent",
            "Report language is factual and non-discriminatory",
          ],
          notes: "Golden-flow QA approval.",
          reworkCheckIds: [],
        },
      }),
      201,
    );
    expect(decision.caseStatus).toBe("COMPLETED");

    const generated = await waitForPublishedReport(api, createdCase.id);
    expect(generated.status).toBe("PUBLISHED");
    expect(generated.sha256).toMatch(/^[a-f0-9]{64}$/);

    const report = await api.get(`reports/${generated.id}/content`);
    expect(report.status()).toBe(200);
    expect(report.headers()["content-type"]).toContain("application/pdf");
    expect((await report.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const verification = await expectJson<{
      valid: boolean;
      reportVersion: number;
      sha256: string;
    }>(await api.get(`public/reports/verify/${generated.authenticityCode}`), 200);
    expect(verification.valid).toBe(true);
    expect(verification.reportVersion).toBe(1);
    expect(verification.sha256).toBe(generated.sha256);

    caseDetail = await getCase(api, createdCase.id);
    expect(caseDetail.status).toBe("COMPLETED");
    expect(caseDetail.documents[0].status).toBe("AVAILABLE");
    expect(caseDetail.clarifications[0].status).toBe("RESOLVED");
    expect(caseDetail.qaReviews[0].decision).toBe("APPROVED");
    expect(caseDetail.reports[0].status).toBe("PUBLISHED");
  } finally {
    await verifierApi?.dispose();
    await api.dispose();
  }
});

type CaseDetail = {
  status: string;
  version: number;
  checks: Array<{ publicId: string; status: string }>;
  consents: Array<{ publicId: string; status: string }>;
  documents: Array<{ status: string }>;
  clarifications: Array<{ status: string }>;
  qaReviews: Array<{ decision: string }>;
  reports: Array<{ status: string }>;
};

async function getCase(api: APIRequestContext, caseId: string): Promise<CaseDetail> {
  return expectJson<CaseDetail>(await api.get(`cases/${caseId}`), 200);
}

async function waitForPublishedReport(
  api: APIRequestContext,
  caseId: string,
): Promise<{ id: string; authenticityCode: string; sha256: string; status: string }> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const reports = await expectJson<{
      items: Array<{
        id: string;
        status: string;
        versions: Array<{ authenticityCode: string; sha256: string }>;
      }>;
    }>(await api.get(`cases/${caseId}/reports`), 200);
    const published = reports.items.find(
      (item) => item.status === "PUBLISHED" && item.versions.length > 0,
    );
    if (published) {
      return {
        id: published.id,
        status: published.status,
        authenticityCode: published.versions[0]!.authenticityCode,
        sha256: published.versions[0]!.sha256,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("The approved case did not receive a published report within 30 seconds");
}

async function expectJson<T = unknown>(response: APIResponse, status: number): Promise<T> {
  const text = await response.text();
  expect(response.status(), text.slice(0, 800)).toBe(status);
  return (text ? JSON.parse(text) : undefined) as T;
}

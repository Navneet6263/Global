import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  createRunUser,
  expectJson,
  getCase,
  openForcedPasswordContext,
  suspendRunUsers,
  waitForPublishedReport,
  type CaseDetail,
} from "./golden-flow-support";

const enabled = process.env.E2E_GOLDEN_FLOW === "true";
const isolated = process.env.E2E_GOLDEN_ISOLATED === "true";
const credentials = {
  tenantCode: process.env.E2E_TENANT_CODE,
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};
const runId = process.env.E2E_GOLDEN_RUN_ID?.toLowerCase();
const apiUrl = `${(process.env.E2E_API_URL ?? "http://127.0.0.1:4100/api/v1").replace(/\/+$/, "")}/`;
const browserOrigin = process.env.E2E_BASE_URL ?? "http://localhost:8080";
test("case lifecycle reaches a verified report through real APIs", async () => {
  test.setTimeout(360_000);
  test.skip(!enabled, "Set E2E_GOLDEN_FLOW=true to run managed write-path verification");
  if (!isolated) {
    throw new Error(
      "E2E_GOLDEN_ISOLATED=true is required: this flow consumes a development-only OTP and must never target staging or production",
    );
  }
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(new URL(apiUrl).hostname)) {
    throw new Error("The isolated golden flow accepts only a loopback API endpoint");
  }
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
  let qaApi: APIRequestContext | undefined;
  const runUserEmails: string[] = [];
  let keyIndex = 0;
  const writeHeaders = () => ({
    "idempotency-key": `golden:${runId}:${String(++keyIndex).padStart(4, "0")}`,
  });

  try {
    await expectJson(await api.post("auth/login", { data: credentials }), 201);

    const verifierEmail = `managed-verifier-${runId}@e2e.invalid`;
    runUserEmails.push(verifierEmail);
    const managedUser = await createRunUser(api, {
      email: verifierEmail,
      displayName: "Golden flow managed verifier",
      role: "VERIFIER",
      writeHeaders,
    });
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
      total: number;
    }>(
      await api.get(`users?search=${encodeURIComponent(managedUser.email)}&page=1&pageSize=1`),
      200,
    );
    expect(userDirectory.total).toBe(1);
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

    const qaEmail = `managed-qa-${runId}@e2e.invalid`;
    runUserEmails.push(qaEmail);
    const qaUser = await createRunUser(api, {
      email: qaEmail,
      displayName: "Golden flow independent QA reviewer",
      role: "QA_REVIEWER",
      writeHeaders,
    });

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

    const catalog = await expectJson<{
      items: Array<{ id: string; code: string; checks: string[] }>;
    }>(await api.get("cases/catalog"), 200);
    const servicePackage = catalog.items.find((item) => item.code === "STANDARD_BGV");
    if (!servicePackage) throw new Error("STANDARD_BGV is not active for the E2E tenant");
    expect(servicePackage.checks).toEqual(["IDENTITY", "ADDRESS", "EMPLOYMENT", "EDUCATION"]);

    const createdCase = await expectJson<{
      id: string;
      status: string;
      consentDelivery: { consentId: string; developmentOtp?: string };
    }>(
      await api.post("cases", {
        headers: writeHeaders(),
        data: {
          clientId: client.publicId,
          servicePackageId: servicePackage.id,
          fullName: "Golden Flow Candidate",
          email: `candidate-${runId}@e2e.invalid`,
          employeeCode: `GF-${runId}`,
          externalRef: `E2E-GOLDEN-${runId}`,
          priority: "HIGH",
        },
      }),
      201,
    );
    expect(createdCase.status).toBe("CONSENT_PENDING");

    const initial = await getCase(api, createdCase.id);
    expect(initial.consents).toHaveLength(1);
    const consent = createdCase.consentDelivery;
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
    const uploadBytes = Buffer.from("%PDF-1.4\n% Sapling Global release verification\n%%EOF\n");
    const upload = await expectJson<{ malwareState: string; sha256: string }>(
      await api.post(`documents/${document.id}/content`, {
        headers: {
          ...writeHeaders(),
          "x-content-sha256": createHash("sha256").update(uploadBytes).digest("hex"),
        },
        multipart: {
          file: {
            name: "golden-flow-passport.pdf",
            mimeType: "application/pdf",
            buffer: uploadBytes,
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
    const tasks: Array<{
      id: string;
      version: number;
      check: CaseDetail["checks"][number];
    }> = [];
    for (const check of caseDetail.checks) {
      const task = await expectJson<{ id: string; version: number }>(
        await api.post(`checks/${check.publicId}/tasks`, {
          headers: writeHeaders(),
          data: {
            assigneeId: managedUser.id,
            instructions: `Validate the ${check.type.toLowerCase()} check and record its authoritative source.`,
          },
        }),
        201,
      );
      tasks.push({ ...task, check });
    }
    expect(tasks).toHaveLength(servicePackage.checks.length);

    verifierApi = await openForcedPasswordContext({
      apiUrl,
      browserOrigin,
      tenantCode: credentials.tenantCode,
      user: managedUser,
      writeHeaders,
    });
    for (const [index, task] of tasks.entries()) {
      const started = await expectJson<{ version: number; status: string }>(
        await verifierApi.patch(`tasks/${task.id}`, {
          headers: writeHeaders(),
          data: { status: "IN_PROGRESS", version: task.version },
        }),
        200,
      );
      expect(started.status).toBe("IN_PROGRESS");
      let completionVersion = started.version;
      if (index === 0) {
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
        expect(
          caseDetail.checks.find((item) => item.publicId === task.check.publicId)?.status,
        ).toBe("BLOCKED");
        const resumed = await expectJson<{ version: number; status: string }>(
          await verifierApi.patch(`tasks/${task.id}`, {
            headers: writeHeaders(),
            data: { status: "IN_PROGRESS", version: blocked.version, findings: [] },
          }),
          200,
        );
        expect(resumed.status).toBe("IN_PROGRESS");
        completionVersion = resumed.version;
      }
      const completed = await expectJson<{ status: string }>(
        await verifierApi.patch(`tasks/${task.id}`, {
          headers: writeHeaders(),
          data: {
            status: "COMPLETED",
            version: completionVersion,
            result: "CLEAR",
            sourceSummary: `${task.check.type} source inspected and details matched.`,
            findings: [],
          },
        }),
        200,
      );
      expect(completed.status).toBe("COMPLETED");
      caseDetail = await getCase(api, createdCase.id);
      expect(caseDetail.status).toBe(index === tasks.length - 1 ? "QA_REVIEW" : "IN_PROGRESS");
    }
    qaApi = await openForcedPasswordContext({
      apiUrl,
      browserOrigin,
      tenantCode: credentials.tenantCode,
      user: qaUser,
      writeHeaders,
    });
    const claim = await expectJson<{ caseVersion: number }>(
      await qaApi.post(`qa/cases/${createdCase.id}/claim`, {
        headers: writeHeaders(),
        data: { caseVersion: caseDetail.version },
      }),
      201,
    );
    const decision = await expectJson<{
      caseStatus: string;
      caseVersion: number;
    }>(
      await qaApi.post(`qa/cases/${createdCase.id}/decision`, {
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
    try {
      await suspendRunUsers(api, runUserEmails, writeHeaders);
    } finally {
      await qaApi?.dispose();
      await verifierApi?.dispose();
      await api.dispose();
    }
  }
});

import type { Page } from "@playwright/test";

export async function dispatchFixture(page: Page) {
  const commits: { id: string; body: Record<string, unknown>; key: string | undefined }[] = [];
  const unexpected: string[] = [];
  const controls = { hold: false, failSecond: false, failPreview: false };
  let release = () => {};
  let gate = Promise.resolve();
  const cases = [1, 2, 3].map((id) => ({
    id: `dispatch-${id}`,
    caseNumber: `DISPATCH-${id}`,
    candidateName: `Candidate ${id}`,
    clientName: "Test Organisation",
    branchName: "Test Branch",
    version: 2,
    status: "DOCUMENT_PENDING",
    ready: id !== 3,
    issues: id === 3 ? ["PAN: reviewed, unexpired document required"] : [],
    eligibleVerifierIds: ["verifier-1", "verifier-2"],
    checks: [1, 2].map((check) => ({
      id: `check-${id}-${check}`,
      type: check === 1 ? "IDENTITY" : "EDUCATION",
      checkVersion: 1,
    })),
  }));
  const rows = cases.map((record) => ({
    id: record.id,
    caseNumber: record.caseNumber,
    status: record.status,
    priority: "NORMAL",
    version: 2,
    createdAt: "2026-09-09T10:00:00Z",
    updatedAt: "2026-09-09T10:00:00Z",
    dueAt: "2026-09-30T10:00:00Z",
    subject: {
      publicId: `subject-${record.id}`,
      fullName: record.candidateName,
      email: "test@example.invalid",
    },
    client: { publicId: "client-test", code: "TEST", displayName: record.clientName },
    checks: record.checks.map((check) => ({
      publicId: check.id,
      type: check.type,
      status: "PENDING",
      version: 1,
      tasks: [],
    })),
    services: [],
    fieldVisits: [],
    consents: [],
    documents: [],
  }));
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/auth/me")
      return reply({
        id: "test-ops",
        tenantId: "test-tenant",
        tenantName: "Test Workspace",
        displayName: "Test Operator",
        email: "ops@example.invalid",
        roles: ["OPS_MANAGER"],
        permissions: ["*"],
        mustChangePassword: false,
      });
    if (path === "/notifications") return reply({ items: [], nextCursor: null, unreadCount: 0 });
    if (path === "/dashboards/navigation")
      return reply({ counts: {}, generatedAt: new Date().toISOString() });
    if (path === "/cases")
      return reply({ items: rows, total: 3, page: 1, pageSize: 10, nextCursor: null });
    if (path === "/clients" || path === "/users")
      return reply({ items: [], total: 0, page: 1, pageSize: 100, nextCursor: null });
    if (path === "/cases/dispatch/preview") {
      if (controls.failPreview)
        return reply({ status: 503, detail: "Readiness temporarily unavailable" }, 503);
      const ids = url.searchParams.get("caseIds")?.split(",") ?? [];
      return reply({
        cases: cases.filter((record) => ids.includes(record.id)),
        unavailableIds: [],
        verifierLimitReached: false,
        workloadScope: "Current authorised workspace",
        verifiers: [1, 2].map((id) => ({
          id: `verifier-${id}`,
          name: `Verifier ${id}`,
          email: `verifier${id}@example.invalid`,
          branchName: "Test Branch",
          activeChecks: id * 3,
          overdue: id - 1,
        })),
      });
    }
    const match = /^\/cases\/dispatch\/(dispatch-\d)\/commit$/.exec(path);
    if (match) {
      commits.push({
        id: match[1]!,
        body: route.request().postDataJSON() as Record<string, unknown>,
        key: route.request().headers()["idempotency-key"],
      });
      if (controls.hold) await gate;
      if (match[1] === "dispatch-2" && controls.failSecond) {
        controls.failSecond = false;
        return reply({ status: 409, detail: "Case changed; refresh readiness" }, 409);
      }
      return reply({ caseId: match[1], assigned: 2, started: true, version: 3 });
    }
    unexpected.push(`${route.request().method()} ${path}`);
    return reply({ status: 501, detail: `Unexpected ${path}` }, 501);
  });
  return {
    commits,
    unexpected,
    controls,
    hold() {
      controls.hold = true;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    release() {
      controls.hold = false;
      release();
    },
  };
}

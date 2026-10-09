import type { Page } from "@playwright/test";

// Test-only network contract. No real candidate, database, provider or notification is used.
export async function methodBrowserFixture(page: Page) {
  const unexpected: string[] = [];
  const writes: Record<string, unknown>[] = [];
  const verified: Array<Array<Record<string, string>>> = [];
  const emails: Array<Record<string, unknown>> = [];
  const methods: Record<string, unknown>[] = [];
  const contacts: Record<string, unknown>[] = [];
  const check = {
    publicId: "check-1",
    type: "IDENTITY",
    status: "IN_PROGRESS",
    result: null,
    tasks: [
      {
        publicId: "task-1",
        status: "OPEN",
        version: 1,
        assignee: { publicId: "verifier-1", displayName: "Assigned verifier" },
      },
    ],
  };
  const row = {
    id: "method-case",
    caseNumber: "METHOD-UI-001",
    status: "IN_PROGRESS",
    priority: "NORMAL",
    version: 1,
    createdAt: "2026-09-08T10:00:00Z",
    updatedAt: "2026-09-08T10:00:00Z",
    dueAt: null,
    subject: {
      publicId: "subject-1",
      fullName: "Source UI Test",
      email: "candidate@example.invalid",
    },
    client: { publicId: "client-1", code: "TEST", displayName: "Test organisation" },
    checks: [check],
    documents: [],
    fieldVisits: [],
    clarifications: [],
    qaReviews: [],
    reports: [],
    statusHistory: [],
    consents: [
      {
        publicId: "consent-1",
        status: "ACCEPTED",
        purpose: "Test-only scope",
        createdAt: "2026-09-08T10:00:00Z",
      },
    ],
    services: [
      {
        publicId: "service-1",
        serviceFamily: "HIRECHECK",
        tatHours: 48,
        requiredDocuments: ["PAN"],
        servicePackage: { publicId: "package-1", code: "HIRE", name: "HireCheck scope" },
        checks: [check],
      },
    ],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const method = route.request().method();
    const reply = (data: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/auth/me")
      return reply({
        id: "operator-1",
        tenantId: "test-tenant",
        tenantName: "Test workspace",
        displayName: "Test Operations",
        email: "ops@example.invalid",
        roles: ["OPS_MANAGER"],
        permissions: ["*"],
        mustChangePassword: false,
      });
    if (path === "/notifications") return reply({ items: [], nextCursor: null, unreadCount: 0 });
    if (path === "/dashboards/navigation")
      return reply({ counts: {}, generatedAt: "2026-09-08T10:00:00Z" });
    if (path === "/cases/method-case") return reply(row);
    if (path === "/cases/method-case/reports") return reply({ items: [] });
    if (path === "/cases/method-case/activity") return reply({ items: [], nextCursor: null });
    if (path === "/checks/check-1/source-emails") {
      if (method === "POST") {
        const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
        emails.push(body);
        return reply({ id: "email-1", maxFollowUps: 7, nextFollowUpAt: "2026-10-08T10:00:00Z" });
      }
      return reply({
        checkType: "EMPLOYMENT",
        followUps: 7,
        draft: {
          subject: "Authorised verification request · SG-1 · EMPLOYMENT",
          body: "We are reviewing the consented verification scope.\n\nCandidate: Source UI Test",
        },
        documents: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            type: "RELIEVING_LETTER",
            name: "relieving.pdf",
            version: 1,
            sizeBytes: 20480,
          },
        ],
        items: emails.length
          ? [
              {
                id: "email-1",
                to: "hr@acme.test",
                cc: [],
                subject: "Authorised verification request · SG-1 · EMPLOYMENT",
                attachments: ["relieving.pdf"],
                maxFollowUps: 7,
                followUpsSent: 0,
                lastSentAt: "2026-10-07T10:00:00Z",
                nextFollowUpAt: "2026-10-08T10:00:00Z",
                stoppedAt: null,
                stopReason: null,
                createdAt: "2026-10-07T10:00:00Z",
              },
            ]
          : [],
      });
    }
    if (path === "/checks/check-1/verified-details") {
      if (method === "PUT") {
        const body = JSON.parse(route.request().postData() ?? "{}") as {
          entries: Array<Record<string, string>>;
        };
        verified.push(body.entries);
        return reply({
          checkId: "check-1",
          verifiedAt: "2026-10-07T10:00:00Z",
          entries: body.entries,
        });
      }
      return reply({
        checkId: "check-1",
        type: "IDENTITY",
        statusLabel: "In progress",
        lhs: {
          form: {
            repeatable: true,
            fields: [
              { key: "idType", label: "ID type", required: true, kind: "select", options: ["PAN"] },
              { key: "idNumber", label: "ID number", required: true },
            ],
          },
          entries: [{ idType: "PAN", idNumber: "ABCDE1234F" }],
        },
        rhs: {
          form: {
            repeatable: true,
            fields: [
              { key: "idType", label: "ID type", required: true },
              { key: "idNumber", label: "ID number (confirmed)", required: true },
              {
                key: "nameMatch",
                label: "Name matches",
                required: true,
                kind: "select",
                options: ["Yes", "No"],
              },
              {
                key: "method",
                label: "Method of verification",
                required: true,
                kind: "select",
                options: ["Government API", "Online portal", "Document check"],
              },
              { key: "verificationDate", label: "Verification date", required: true, kind: "date" },
            ],
          },
          entries: [],
          verifiedAt: null,
        },
      });
    }
    if (path === "/checks/check-1/methods" && method === "GET")
      return reply({
        items: methods,
        caseStatus: "IN_PROGRESS",
        digitalMode: "RECORDED_EVIDENCE",
        evidenceDocuments: [
          { publicId: "document-1", type: "PAN", status: "VERIFIED", currentVersion: 2 },
        ],
      });
    if (path === "/checks/check-1/methods" && method === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push(body);
      methods.push({
        ...body,
        id: "source-1",
        status: "REQUESTED",
        result: null,
        reference: null,
        summary: null,
        version: 1,
        evidenceIds: [],
        requestedAt: "2026-09-08T10:00:00Z",
        respondedAt: null,
      });
      return reply({ id: "source-1", status: "REQUESTED", version: 1 });
    }
    if (path === "/checks/check-1/methods/source-1" && method === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push(body);
      Object.assign(methods[0], body, {
        status: "RESPONDED",
        version: 2,
        respondedAt: "2026-09-08T10:10:00Z",
      });
      return reply({ id: "source-1", status: "RESPONDED", version: 2 });
    }
    if (path === "/checks/check-1/methods/source-1/outreach") {
      if (method === "POST") {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        writes.push(body);
        methods[0]!.version = Number(body.version) + 1;
        contacts.unshift({
          ...body,
          id: "contact-new",
          actorName: "Test Operations",
          createdAt: body.occurredAt,
        });
        return reply({ id: "contact-new", version: methods[0]!.version });
      }
      const pageNumber = Number(new URL(route.request().url()).searchParams.get("page") ?? 1);
      return reply({
        items: contacts.slice((pageNumber - 1) * 8, pageNumber * 8),
        total: contacts.length,
        page: pageNumber,
        pageSize: 8,
        template: {
          subject: "Source request METHOD-UI-001",
          body: "Please verify through an authorised source.",
          delivery: "COPY_ONLY",
        },
      });
    }
    unexpected.push(`${method} ${path}`);
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ title: `Unexpected test request: ${path}` }),
    });
  });
  return { unexpected, writes, methods, contacts, verified, emails };
}

import { createHash } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Browser-only contract fixture. It never uploads to the shared database or storage.
export async function agreementFixture(
  page: Page,
  {
    rejectFirstUpload = false,
    holdUpload = false,
    reviewMode = false,
    rejectFirstReview = false,
  } = {},
) {
  let releaseUpload = () => {};
  const uploadGate = holdUpload
    ? new Promise<void>((resolve) => {
        releaseUpload = resolve;
      })
    : Promise.resolve();
  let releaseReview = () => {};
  const reviewGate = new Promise<void>((resolve) => {
    releaseReview = resolve;
  });
  const reviews: string[] = [];
  const uploads: string[] = [];
  const unexpected: string[] = [];
  const files: Record<string, unknown>[] = [];
  const bytes = Buffer.from("Synthetic contract bytes for a browser transport test.");
  const row = {
    id: "lead-test",
    version: 1,
    companyName: "Contract Test Client",
    contactName: "Test contact",
    contactEmail: "client@example.invalid",
    contactPhone: "+919876543210",
    stage: "WON",
    estimatedValue: 5000,
    probability: 100,
    source: "INBOUND",
    owner: null,
    client: { publicId: "client-test", displayName: "Contract Test Client" },
    onboardingHandoffAt: "2026-09-09T10:00:00Z",
    createdAt: "2026-09-09T10:00:00Z",
    updatedAt: "2026-09-09T10:00:00Z",
    activities: [],
  };
  const commercial = {
    id: "client-test",
    version: 1,
    gstin: null,
    billingAddress: "Test billing address",
    billingTerms: "Payment within 15 days",
    packages: [],
    catalog: [],
    agreements: [] as Array<{ id: string; type: string; reference: string; signedAt: string }>,
  };
  if (reviewMode) {
    commercial.agreements.push({
      id: "agreement-test",
      type: "AGREEMENT",
      reference: "TEST-AGREEMENT-001",
      signedAt: "2026-09-09",
    });
    files.push({
      id: "file-test",
      revision: 1,
      version: 1,
      originalName: "test-agreement.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      sha256: "",
      status: "PENDING",
      isUploader: false,
      reviewedAt: null,
      reviewNotes: null,
      createdAt: "2026-09-09T10:01:00Z",
    });
  }
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/auth/me")
      return reply({
        id: "sales-test",
        tenantId: "tenant-test",
        tenantName: "Test workspace",
        displayName: "Test Sales",
        email: "sales@example.invalid",
        roles: ["SALES_MANAGER"],
        permissions: ["crm:read", "crm:write", "client:read", "client:write", "notification:read"],
        mustChangePassword: false,
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0, nextCursor: null });
    if (path === "/dashboards/navigation") return reply({ counts: {}, generatedAt: row.updatedAt });
    if (path === "/crm/overview")
      return reply({
        summary: {
          openCount: 0,
          openValue: 0,
          weightedValue: 0,
          wonValue: 5000,
          activeOwners: 0,
          wonCount: 1,
          lostCount: 0,
          winRate: 100,
          pendingFollowUps: 0,
          overdueFollowUps: 0,
          unassignedOpportunities: 0,
        },
        stages: [],
        trend: [],
        activities: [],
        followUps: [],
        generatedAt: row.updatedAt,
      });
    if (path === "/crm/owners") return reply({ items: [] });
    if (path === "/crm/opportunities")
      return reply({ items: [row], total: 1, page: 1, pageSize: 10 });
    if (path === "/crm/opportunities/lead-test") return reply(row);
    if (path === "/clients/client-test/commercial") {
      if (request.method() === "PUT") {
        const input = request.postDataJSON();
        expect(input.version).toBe(commercial.version);
        commercial.version++;
        commercial.agreements.push({ id: "agreement-test", ...input.agreements[0] });
      }
      return reply(commercial);
    }
    if (path === "/clients/client-test/agreements/agreement-test/files") {
      if (request.method() === "POST") {
        const digest = request.headers()["x-content-sha256"];
        const body = request.postDataBuffer();
        expect(request.headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
        expect(request.headers()["idempotency-key"]).toBeTruthy();
        expect(body?.includes(bytes)).toBe(true);
        expect(digest).toBe(createHash("sha256").update(bytes).digest("hex"));
        uploads.push(digest);
        await uploadGate;
        if (rejectFirstUpload && uploads.length === 1)
          return reply(
            { status: 400, detail: "PDF is damaged, encrypted, or cannot be read safely" },
            400,
          );
        files.unshift({
          id: "file-test",
          revision: 1,
          version: 1,
          originalName: "test-agreement.pdf",
          mimeType: "application/pdf",
          sizeBytes: bytes.length,
          sha256: digest,
          status: "PENDING",
          isUploader: true,
          reviewedAt: null,
          reviewNotes: null,
          createdAt: "2026-09-09T10:01:00Z",
        });
        commercial.version++;
        return reply({ id: "file-test", revision: 1 }, 201);
      }
      return reply({ items: files });
    }
    if (
      path === "/clients/client-test/agreements/agreement-test/files/file-test" &&
      request.method() === "PATCH"
    ) {
      const input = request.postDataJSON();
      expect(input.version).toBe(files[0].version);
      reviews.push(input.status);
      await reviewGate;
      if (rejectFirstReview && reviews.length === 1)
        return reply({ status: 409, detail: "Contract review changed; please retry." }, 409);
      Object.assign(files[0], { status: input.status, version: Number(files[0].version) + 1 });
      return reply(files[0]);
    }
    unexpected.push(`${request.method()} ${path}`);
    return reply({ status: 501, detail: "Unexpected test request" }, 501);
  });
  await page.goto("/sales-crm/opportunities?opportunityId=lead-test&view=table");
  await page.getByRole("button", { name: "Client agreements & rates", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Contract Test Client: commercial onboarding" });
  if (!reviewMode) {
    await expect(dialog.getByText("Save a reference above to attach a document.")).toBeVisible();
    await dialog.getByLabel("New agreement reference").fill("TEST-AGREEMENT-001");
    await dialog.getByLabel("Signed on").fill("2026-09-09");
    await dialog.getByRole("button", { name: "Save commercial settings", exact: true }).click();
  }
  await expect(dialog.getByLabel("Saved agreement").locator("option")).toHaveCount(2);
  await dialog.getByLabel("Saved agreement").selectOption("agreement-test");
  await expect(dialog.getByRole("button", { name: "Upload new revision" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Upload new revision" })).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  await dialog.getByLabel("Original agreement file").setInputFiles({
    name: "test-agreement.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  return { dialog, uploads, unexpected, releaseUpload, reviews, releaseReview };
}

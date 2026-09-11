import type { Page } from "@playwright/test";
import { createRequire } from "node:module";

// Isolated transport fixtures: no real files, account, storage or database is accessed.
const require = createRequire(new URL("../../../backend/package.json", import.meta.url));
const { PDFDocument } = require("pdf-lib") as typeof import("pdf-lib");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=",
  "base64",
);

export async function documentPreviewFixture(page: Page) {
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Synthetic document preview test - no personal information");
  const pdfBytes = Buffer.from(await pdf.save());
  const requests: string[] = [];
  const unexpected: string[] = [];
  const controls = { failNext: false, hold: false };
  let release = () => {};
  let gate = Promise.resolve();
  const documents = [
    {
      publicId: "document-pdf",
      type: "PAN",
      filename: "proof.pdf",
      contentType: "application/pdf",
    },
    {
      publicId: "document-image",
      type: "AADHAAR",
      filename: "proof.png",
      contentType: "image/png",
    },
  ].map((item) => ({
    publicId: item.publicId,
    type: item.type,
    status: "AVAILABLE",
    currentVersion: 1,
    version: 1,
    createdAt: "2026-09-09T10:00:00Z",
    updatedAt: "2026-09-09T10:00:00Z",
    versions: [
      {
        version: 1,
        originalName: item.filename,
        contentType: item.contentType,
        sizeBytes: "1024",
        malwareState: "CLEAN",
        sha256: "a".repeat(64),
        createdAt: "2026-09-09T10:00:00Z",
      },
    ],
  }));
  const row = {
    id: "preview-case",
    caseNumber: "PREVIEW-TEST-001",
    status: "DOCUMENT_PENDING",
    priority: "NORMAL",
    version: 1,
    createdAt: "2026-09-09T10:00:00Z",
    updatedAt: "2026-09-09T10:00:00Z",
    dueAt: null,
    subject: {
      publicId: "subject-test",
      fullName: "Preview Test Candidate",
      email: "preview@example.invalid",
    },
    client: { publicId: "client-test", code: "TEST", displayName: "Preview Test Organisation" },
    checks: [],
    documents,
    fieldVisits: [],
    clarifications: [],
    qaReviews: [],
    reports: [],
    statusHistory: [],
    services: [],
    consents: [],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/auth/me")
      return reply({
        id: "operator-test",
        tenantId: "tenant-test",
        tenantName: "Test workspace",
        displayName: "Preview Operator",
        email: "operator@example.invalid",
        roles: ["OPS_MANAGER"],
        permissions: ["*"],
        mustChangePassword: false,
      });
    if (path === "/notifications") return reply({ items: [], nextCursor: null, unreadCount: 0 });
    if (path === "/dashboards/navigation")
      return reply({ counts: {}, generatedAt: new Date().toISOString() });
    if (path === "/cases/preview-case") return reply(row);
    if (path === "/cases/preview-case/reports") return reply({ items: [] });
    if (path === "/cases")
      return reply({ items: [row], total: 1, page: 1, pageSize: 10, nextCursor: null });
    if (path === "/clients" || path === "/users")
      return reply({ items: [], total: 0, page: 1, pageSize: 100, nextCursor: null });
    if (path === "/cases/preview-case/evidence-readiness")
      return reply({ ready: true, issues: [], requiredTypes: [] });
    if (/^\/documents\/document-(pdf|image)\/(preview|content)$/.test(path)) {
      requests.push(path);
      if (controls.hold) await gate;
      if (controls.failNext) {
        controls.failNext = false;
        return reply({ status: 403, detail: "Document access is not allowed." }, 403);
      }
      const image = path.includes("document-image");
      return route.fulfill({
        status: 200,
        contentType: image ? "image/png" : "application/pdf",
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": `${path.endsWith("preview") ? "inline" : "attachment"}; filename="proof.${image ? "png" : "pdf"}"`,
        },
        body: image ? png : pdfBytes,
      });
    }
    unexpected.push(`${route.request().method()} ${path}`);
    return reply({ detail: `Unexpected test request ${path}` }, 501);
  });
  return {
    requests,
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
